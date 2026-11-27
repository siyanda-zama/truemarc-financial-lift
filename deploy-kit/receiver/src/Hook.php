<?php

declare(strict_types=1);

namespace DeployKit;

use Closure;
use Throwable;

/**
 * POST https://<site>/_deploy/hook.php: the server side of deploys on FTP-only hosting (no SSH).
 *
 * The workflow calls it with the X-Deploy-Token header and a JSON body naming an action:
 *
 *   {"action":"capabilities"}   read-only: receiver version, layout, mode, releases, adopt candidates
 *   {"action":"probe"}          puts a symlink probe under /_deploy/ for the workflow to fetch (first release)
 *   {"action":"release","release":"<id>","sha256":"<hex>","symlinks":true|false,"mode":"symlink|rename","adopt":"move"}
 *                               verify and unpack ~/<DEPLOY_DIR>/incoming/<id>.zip, run the new release's
 *                               app/deploy/after-unpack.php, switch the live site atomically, keep 3
 *   {"action":"confirm","release":"<id>"}   the live release passed the smoke test
 *   {"action":"rollback"}       back to the previous release (or {"release":"<id>"} / {"release":"legacy"})
 *
 * - Off unless DEPLOY_HOOK_TOKEN in ~/<APP_DIR>/.env is set (32+ characters).
 * - The token comes in X-Deploy-Token, never Authorization: some cPanel PHP setups drop that header.
 *   Both sides are hashed to a fixed length and compared with hash_equals().
 * - A disabled hook, a wrong or missing token and rate limiting (30 calls / 15 min / client IP) all
 *   answer 404, so the endpoint looks like one that does not exist.
 * - One run at a time (a lock file); a second one gets 409 deploy_hook_busy.
 * - Every call is logged to ~/<APP_DIR>/storage/logs/deploy-hook.log, never the token. Error details go
 *   there; HTTP answers carry only an error code and the request id (plus the read-only capabilities).
 */
final class Hook
{
    public const MIN_TOKEN_LENGTH = 32;
    public const MAX_CALLS = 30; // a deploy uses 4-8 calls; 30 leaves room for a retry and a rollback. The 256-bit token, not this limit, is the protection.
    public const WINDOW_SECONDS = 900;
    private const MAX_BODY_BYTES = 65536;
    private const LOG_MAX_BYTES = 5 * 1024 * 1024;

    private string $requestId;

    /** @var array<string,string> */
    private array $env = [];

    /** @param list<string> $sources the src/ classes hook.php loads (for the receiver digest) */
    public function __construct(
        private readonly string $receiverDir,
        private readonly string $home,
        private readonly string $appDir,
        private readonly string $deployDir,
        private readonly string $docrootName,
        private readonly array $sources = [],
    ) {
        $this->requestId = bin2hex(random_bytes(8));
    }

    /**
     * The layout the stub declared: ~/<DEPLOY_DIR>/receiver is this folder, so the cPanel home is two up.
     *
     * @param list<string> $sources
     */
    public static function fromStub(string $receiverDir, array $sources): self
    {
        $name = static fn (string $constant, string $default): string => defined($constant) && is_string(constant($constant)) ? (string) constant($constant) : $default;
        $actual = basename(dirname($receiverDir));
        $declared = $name('DEPLOY_KIT_DEPLOY_DIR', $actual);
        return new self(
            $receiverDir,
            dirname($receiverDir, 2),
            $name('DEPLOY_KIT_APP_DIR', ''),
            $declared === $actual ? $actual : '',
            trim($name('DEPLOY_KIT_DOCROOT', 'public_html'), '/'),
            $sources,
        );
    }

    public function handle(): never
    {
        if (!$this->namesValid()) {
            $this->notFound();
        }
        $this->env = Env::load($this->appHome() . '/.env');
        $context = $this->context();
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            $this->log('not_post', $context);
            $this->notFound();
        }
        $expected = trim($this->env['DEPLOY_HOOK_TOKEN'] ?? '');
        if (strlen($expected) < self::MIN_TOKEN_LENGTH) {
            $this->log('disabled', $context);
            $this->notFound();
        }
        $limiter = new RateLimiter($this->storage('ratelimits'));
        if ($limiter->tooManyAttempts('deploy-hook|' . ClientIp::bucket($context['client_ip']), self::MAX_CALLS, self::WINDOW_SECONDS)) {
            $this->log('rate_limited', $context);
            $this->notFound();
        }
        $provided = trim((string) ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? ''));
        if (!hash_equals(hash('sha256', $expected), hash('sha256', $provided))) {
            $this->log('denied', $context);
            $this->notFound();
        }

        $body = $this->body();
        $action = $body['action'] ?? null;
        if ($body === null || !is_string($action) || !in_array($action, ReleaseManager::ACTIONS, true)) {
            $this->log('bad_request', $context);
            $this->fail('invalid_request', 422, null);
        }
        $context['action'] = $action;
        if (is_string($body['release'] ?? null) && preg_match(ReleaseManager::ID_PATTERN, $body['release']) === 1) {
            $context['release'] = $body['release'];
        }
        $this->log('accepted', $context);
        // A release must finish once started, even if the workflow (or Cloudflare's 100 s proxy timeout) gives up.
        ignore_user_abort(true);
        @set_time_limit(300);

        $storage = $this->storage();
        if (!is_dir($storage)) {
            @mkdir($storage, 0750, true);
        }
        // Best effort: refuse a second concurrent run, but carry on where the filesystem has no locking.
        $lock = @fopen($storage . '/deploy-hook.lock', 'c');
        $wouldBlock = 0;
        if ($lock !== false && !flock($lock, LOCK_EX | LOCK_NB, $wouldBlock) && $wouldBlock === 1) {
            $this->log('busy', $context);
            $this->fail('deploy_hook_busy', 409, null);
        }

        $manager = $this->manager();
        try {
            $data = match ($action) {
                'capabilities' => [],
                'probe' => $this->guarded($manager, static fn (): array => ['probe' => $manager->probe()]),
                'release' => $this->guarded($manager, fn (): array => $manager->release(
                    is_string($body['release'] ?? null) ? $body['release'] : '',
                    is_string($body['sha256'] ?? null) ? $body['sha256'] : '',
                    fn (array $release): array => $this->afterUnpack($release, $context),
                    is_bool($body['symlinks'] ?? null) ? $body['symlinks'] : null,
                    is_string($body['mode'] ?? null) && $body['mode'] !== '' ? $body['mode'] : null,
                    is_string($body['adopt'] ?? null) && $body['adopt'] !== '' ? $body['adopt'] : null,
                )),
                'confirm' => $this->guarded($manager, static fn (): array => $manager->confirm(is_string($body['release'] ?? null) ? $body['release'] : '')),
                'rollback' => $this->guarded($manager, static fn (): array => $manager->rollback(is_string($body['release'] ?? null) && $body['release'] !== '' ? $body['release'] : null)),
            };
        } catch (ReleaseException $exception) {
            $this->log($action . '_failed', $context + ['error' => $exception->errorCode, 'reason' => $exception->getMessage(), 'details' => $exception->details]);
            $this->fail($exception->errorCode, $exception->status, $manager);
        } catch (Throwable $exception) {
            $this->log($action . '_failed', $context + ['error' => 'internal_error', 'reason' => $exception::class . ': ' . $exception->getMessage() . ' at ' . basename($exception->getFile()) . ':' . $exception->getLine()]);
            $this->fail('internal_error', 500, $manager);
        }
        $this->log($action . '_ok', $context + array_filter([
            'mode' => $data['mode'] ?? null,
            'previous' => $data['previous'] ?? null,
            'to' => $action === 'rollback' ? ($data['release'] ?? 'legacy') : null,
            'from' => $data['rolled_back_from'] ?? null,
        ], static fn (mixed $value): bool => $value !== null));
        $this->respond(200, ['ok' => true, 'request_id' => $this->requestId, 'data' => $data, 'capabilities' => $this->capabilities($manager)]);
    }

    /**
     * Runs app/deploy/after-unpack.php of the NEW release, before anything is switched. The file either
     * returns an array (with $context in scope) or returns a function that takes $context and returns one.
     * If it throws, the release is deleted again and the live site is untouched.
     *
     * @param array<string,mixed> $release
     * @param array<string,mixed> $context the log context
     * @return array{after_unpack:?array<string,mixed>}
     */
    private function afterUnpack(array $release, array $context): array
    {
        $file = $release['app_dir'] . '/deploy/after-unpack.php';
        if (!is_file($file)) {
            return ['after_unpack' => null];
        }
        $hookContext = $release + [
            'home' => $this->home,
            'app_home' => $this->appHome(),
            'docroot' => $this->home . '/' . $this->docrootName,
            'deploy_dir' => $this->home . '/' . $this->deployDir,
            'env' => $this->env,
            'log' => function (string $message) use ($context): void {
                $this->log('after_unpack_log', $context + ['message' => substr($message, 0, 2000)]);
            },
        ];
        ob_start();
        try {
            $result = (static function (string $deployKitFile, array $context): mixed {
                return require $deployKitFile;
            })($file, $hookContext);
            if ($result instanceof Closure || (is_object($result) && method_exists($result, '__invoke'))) {
                $result = $result($hookContext);
            }
        } catch (Throwable $exception) {
            $output = (string) ob_get_clean();
            $this->log('after_unpack_failed', $context + [
                'error' => $exception::class,
                'reason' => substr($exception->getMessage(), 0, 2000),
                'at' => basename($exception->getFile()) . ':' . $exception->getLine(),
                'output' => substr($output, 0, 2000),
            ]);
            throw new ReleaseException('after_unpack_failed', 'app/deploy/after-unpack.php threw ' . $exception::class . '.', 500);
        }
        $output = trim((string) ob_get_clean());
        // `require` gives 1 for a file without a return statement.
        if ($result === 1 || $result === null || $result === true) {
            $result = [];
        }
        if (!is_array($result)) {
            throw new ReleaseException('after_unpack_failed', 'app/deploy/after-unpack.php must return an array (or a function returning one).', 500);
        }
        return ['after_unpack' => $result + ($output !== '' ? ['output' => substr($output, 0, 2000)] : [])];
    }

    /**
     * Releases move files inside the document root: make sure it is the folder this site is served from.
     * An addon domain has its own document root; the stub's DEPLOY_KIT_DOCROOT must name it.
     *
     * @param Closure(): array<string,mixed> $work
     * @return array<string,mixed>
     */
    private function guarded(ReleaseManager $manager, Closure $work): array
    {
        if ($this->documentRootOk($manager) === false) {
            throw new ReleaseException('document_root_mismatch', 'This site\'s document root is not ~/' . $this->docrootName . ' (an addon domain?). Set the DOCROOT variable to its folder.', 409);
        }
        return $work();
    }

    private function documentRootOk(ReleaseManager $manager): ?bool
    {
        $documentRoot = (string) ($_SERVER['DOCUMENT_ROOT'] ?? '');
        if ($documentRoot === '') {
            return null;
        }
        $real = realpath($documentRoot);
        return $real !== false && $real === realpath($manager->docroot());
    }

    private function manager(): ReleaseManager
    {
        [$keep] = $this->keepList();
        $maxMb = (int) ($this->env['DEPLOY_MAX_ARCHIVE_MB'] ?? 0);
        return new ReleaseManager(
            $this->home,
            $this->home . '/' . $this->docrootName,
            $this->home . '/' . $this->deployDir,
            $this->appHome(),
            $keep,
            $maxMb > 0 ? $maxMb * 1024 * 1024 : ReleaseManager::DEFAULT_MAX_ARCHIVE_BYTES,
        );
    }

    /** @return array{0:list<string>,1:list<string>} DEPLOY_KEEP names, and the entries that are not plain names */
    private function keepList(): array
    {
        $keep = [];
        $ignored = [];
        foreach (preg_split('/[\s,]+/', trim($this->env['DEPLOY_KEEP'] ?? ''), -1, PREG_SPLIT_NO_EMPTY) ?: [] as $entry) {
            $name = trim($entry, '/');
            if (ReleaseManager::plainName($name)) {
                $keep[] = $name;
            } else {
                $ignored[] = substr($entry, 0, 80);
            }
        }
        return [$keep, $ignored];
    }

    /** @return array<string,mixed> */
    private function capabilities(?ReleaseManager $manager): array
    {
        $own = [
            'receiver_version' => $this->version(),
            'receiver_digest' => $this->receiverDigest(),
            'php_version' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'names' => ['app_dir' => $this->appDir, 'deploy_dir' => $this->deployDir, 'docroot' => $this->docrootName],
            'deploy_keep_ignored' => $this->keepList()[1],
        ];
        if ($manager === null) {
            return $own;
        }
        try {
            return $own + ['document_root_ok' => $this->documentRootOk($manager)] + $manager->capabilities();
        } catch (Throwable) {
            return $own + ['error' => 'state unreadable'];
        }
    }

    public function version(): string
    {
        $version = trim((string) @file_get_contents($this->receiverDir . '/VERSION'));
        return preg_match('/^\d+\.\d+\.\d+$/', $version) === 1 ? $version : '0.0.0';
    }

    /** sha256 over "<file>\t<sha256>\n" lines (byte-sorted names): the workflow compares it with its own copy. */
    public function receiverDigest(): string
    {
        $files = ['hook.php', 'VERSION'];
        foreach ($this->sources as $source) {
            $files[] = 'src/' . $source . '.php';
        }
        sort($files, SORT_STRING);
        $lines = '';
        foreach ($files as $file) {
            $hash = @hash_file('sha256', $this->receiverDir . '/' . $file);
            $lines .= $file . "\t" . (is_string($hash) ? $hash : 'missing') . "\n";
        }
        return hash('sha256', $lines);
    }

    private function namesValid(): bool
    {
        if (!ReleaseManager::plainName($this->appDir) || !ReleaseManager::plainName($this->deployDir) || $this->docrootName === '') {
            return false;
        }
        foreach (explode('/', $this->docrootName) as $segment) {
            if (!ReleaseManager::plainName($segment)) {
                return false;
            }
        }
        return true;
    }

    private function appHome(): string
    {
        return $this->home . '/' . $this->appDir;
    }

    private function storage(string $path = ''): string
    {
        return $this->appHome() . '/storage' . ($path === '' ? '' : '/' . $path);
    }

    /** @return array<string,mixed>|null */
    private function body(): ?array
    {
        $raw = (string) file_get_contents('php://input', false, null, 0, self::MAX_BODY_BYTES + 1);
        if (strlen($raw) > self::MAX_BODY_BYTES) {
            return null;
        }
        $decoded = json_decode($raw === '' ? '{}' : $raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    /** @return array<string,mixed> */
    private function context(): array
    {
        $commit = strtolower(trim((string) ($_SERVER['HTTP_X_DEPLOY_COMMIT'] ?? '')));
        $run = trim((string) ($_SERVER['HTTP_X_DEPLOY_RUN'] ?? ''));
        return [
            'client_ip' => ClientIp::resolve($_SERVER),
            'remote_addr' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
            'method' => substr((string) ($_SERVER['REQUEST_METHOD'] ?? ''), 0, 10),
            'user_agent' => substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 160),
            'commit' => preg_match('/^[0-9a-f]{7,40}$/', $commit) === 1 ? $commit : null,
            'run' => preg_match('/^[0-9]{1,20}$/', $run) === 1 ? $run : null,
        ];
    }

    /** @param array<string,mixed> $context */
    private function log(string $event, array $context): void
    {
        // Without ~/<APP_DIR> the hook is not set up: a scanner's request must not create folders.
        if (!is_dir($this->appHome())) {
            return;
        }
        $directory = $this->storage('logs');
        if (!is_dir($directory)) {
            @mkdir($directory, 0750, true);
        }
        $file = $directory . '/deploy-hook.log';
        if (@filesize($file) > self::LOG_MAX_BYTES) {
            @rename($file, $file . '.1');
        }
        $line = json_encode(['time' => gmdate(DATE_ATOM), 'request_id' => $this->requestId, 'event' => $event] + $context, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if ($line !== false) {
            @file_put_contents($file, $line . "\n", FILE_APPEND | LOCK_EX);
        }
    }

    private function fail(string $code, int $status, ?ReleaseManager $manager): never
    {
        $this->respond($status, ['ok' => false, 'request_id' => $this->requestId, 'error' => ['code' => $code], 'capabilities' => $this->capabilities($manager ?? $this->manager())]);
    }

    /** @param array<string,mixed> $payload */
    private function respond(int $status, array $payload): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex');
        header('X-Content-Type-Options: nosniff');
        header_remove('X-Powered-By');
        echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR);
        exit;
    }

    /** Looks like any other missing file. */
    private function notFound(): never
    {
        http_response_code(404);
        header('Content-Type: text/html; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Robots-Tag: noindex');
        header_remove('X-Powered-By');
        echo "<!DOCTYPE html>\n<title>404 Not Found</title>\n<h1>Not Found</h1>\n<p>The requested URL was not found on this server.</p>\n";
        exit;
    }
}
