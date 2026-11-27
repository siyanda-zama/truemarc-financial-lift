<?php

declare(strict_types=1);

namespace DeployKit;

use Closure;
use JsonException;
use Throwable;

/**
 * Zip releases on cPanel hosting without SSH.
 *
 *   ~/<DEPLOY_DIR>/
 *     receiver/                      this code (the workflow's bootstrap uploads it)
 *     incoming/<id>.zip, <id>.json   uploaded by the workflow (curl -T over FTPS), removed after a release
 *     releases/<id>/                 one unpacked release; never edit files in here
 *       public_html/                 the site, served through ~/<DOCROOT>/_current
 *       root/                        installed into the real document root: .htaccess, a front controller…
 *       app/                         code outside the web root (optional); ~/<DEPLOY_DIR>/current-app
 *       release.json                 id, checksum, git commit, times
 *     current.json                   the live release id (a PHP front controller reads it on every request)
 *     current-app -> releases/<id>/app   for cron jobs (where PHP may create symlinks)
 *     state.json                     mode, release history, installed root files, the legacy record
 *     backup/                        the last live .htaccess files before each switch
 *     legacy/<time>/                 the site that was there before the first release (moved, never deleted)
 *     orphans/                       folders a switch had to move aside
 *
 *   ~/<DOCROOT>/ stays a real folder (cPanel's document root). Its .htaccess serves the site from _current/
 *   (and the release before from _previous/); persistent names (.well-known, cgi-bin, media, _deploy,
 *   .user.ini, php.ini, cPanel's .htaccess blocks, DEPLOY_KEEP) stay in the real folder, untouched.
 *
 * Switch modes, chosen at the first release and kept in state.json:
 *   symlink  _current and _previous are symlinks into releases/; switching is rename() of a new symlink
 *            over the old one: atomic. Needs Apache/LiteSpeed to follow owner-matching symlinks (probed).
 *   rename   _current and _previous are real folders moved in and out of releases/ with rename(); the
 *            live tree is never missing (while _current is renamed away, .htaccess serves _previous).
 * A PHP app's front controller switches separately and atomically through current.json (a file rename),
 * so PHP's realpath and opcache caches never pin an old release behind a symlink.
 */
final class ReleaseManager
{
    public const KEEP = 3;
    public const ID_PATTERN = '/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/';
    public const DEFAULT_MAX_ARCHIVE_BYTES = 300 * 1024 * 1024;
    public const ACTIONS = ['capabilities', 'probe', 'release', 'confirm', 'rollback'];
    public const MARKER = '.deploy-release';

    /** Top-level names in the document root that a deploy never moves, replaces or deletes (.htaccess is
     *  replaced, but cPanel's blocks in it are kept and the old file is backed up). */
    public const PERSISTENT = ['.well-known', 'cgi-bin', 'media', '.user.ini', 'php.ini', 'error_log', '.ftpquota', '_deploy', '.htaccess', '_current', '_previous'];

    /** Ids with a meaning of their own in a rollback request. */
    private const RESERVED_IDS = ['legacy', 'none', 'current', 'previous'];

    /** @var Closure(): int */
    private Closure $clock;

    /** @var list<string> */
    private array $keep;

    /** @param list<string> $keep DEPLOY_KEEP: more top-level names in the document root to leave alone */
    public function __construct(
        private readonly string $home,
        private readonly string $docroot,
        private readonly string $deployDir,
        private readonly string $appHome,
        array $keep = [],
        private readonly int $maxArchiveBytes = self::DEFAULT_MAX_ARCHIVE_BYTES,
        ?Closure $clock = null,
        private readonly ?bool $symlinkFunction = null,
    ) {
        $this->clock = $clock ?? static fn (): int => time();
        $this->keep = array_values(array_filter($keep, static fn (mixed $name): bool => is_string($name) && self::plainName($name)));
    }

    public static function plainName(string $name): bool
    {
        return $name !== '.' && $name !== '..' && preg_match('/^[A-Za-z0-9._-]{1,255}$/', $name) === 1;
    }

    public function docroot(): string
    {
        return $this->docroot;
    }

    /* ───────────── capabilities and probe ───────────── */

    /** @return array<string,mixed> */
    public function capabilities(): array
    {
        $state = $this->state();
        $flat = $state['current'] === null;
        $capabilities = [
            'release_api' => 1,
            'actions' => self::ACTIONS,
            'extractor' => ArchiveExtractor::available(),
            'symlink_function' => $this->canSymlink(),
            'docroot' => $this->relative($this->home, $this->docroot),
            'docroot_exists' => is_dir($this->docroot),
            'layout' => $flat ? 'flat' : 'release',
            'mode' => $state['mode'],
            'current' => $state['current'],
            'previous' => $state['fallback'],
            'confirmed' => $this->lastGood($state),
            'releases' => array_column($state['releases'], 'id'),
            'rollback_target' => $flat ? null : ($this->rollbackTarget($state) ?? ($this->legacyRestorable($state) ? 'legacy' : null)),
            'incoming' => $this->relative($this->home, $this->deployDir . '/incoming'),
            'max_archive_bytes' => $this->maxArchiveBytes,
            'keep_releases' => self::KEEP,
            'kept_in_place' => $this->keptInPlace(),
            'legacy' => $this->legacySummary($state),
        ];
        if ($flat) {
            $candidates = $this->adoptCandidates();
            $capabilities['adopt_candidates'] = $candidates;
            $capabilities['adopt_suspicious'] = array_values(array_filter($candidates, fn (string $name): bool => $this->looksLikeAnotherSite($name)));
            $capabilities['replaces'] = is_file($this->docroot . '/.htaccess') ? ['.htaccess'] : [];
        }
        return $capabilities;
    }

    /**
     * Puts a symlink into ~/<DOCROOT>/_deploy/ that points into ~/<DEPLOY_DIR>/probe, with a random file
     * behind it. The workflow fetches it over HTTPS, exactly like a visitor: if the web server serves it,
     * it follows symlinks PHP creates (SymLinksIfOwnerMatch), so _current can be one too.
     *
     * @return array{url_path:string,expect:string}|null null when PHP cannot create symlinks
     */
    public function probe(): ?array
    {
        $this->requireLayout();
        $this->cleanupProbes();
        if (!$this->canSymlink()) {
            return null;
        }
        $nonce = bin2hex(random_bytes(12));
        $probeDir = $this->deployDir . '/probe';
        $slot = $this->docroot . '/_deploy';
        $this->mkdir($probeDir);
        $this->mkdir($slot);
        if (@file_put_contents($probeDir . '/' . $nonce . '.txt', $nonce) === false) {
            throw new ReleaseException('probe_failed', 'Could not write the symlink probe file.', 500);
        }
        if (!@symlink($this->relative($slot, $probeDir), $slot . '/probe-' . $nonce)) {
            return null;
        }
        return ['url_path' => '/_deploy/probe-' . $nonce . '/' . $nonce . '.txt', 'expect' => $nonce];
    }

    /* ───────────── release ───────────── */

    /**
     * Verifies incoming/<id>.zip, unpacks it into releases/<id>, runs $prepare (the release's
     * after-unpack step) and switches the live site to it.
     *
     * @param Closure(array<string,mixed>): array<string,mixed> $prepare throws to stop before the switch
     * @param bool|null $symlinks the workflow's probe result (only used while no mode is chosen yet)
     * @param string|null $mode "symlink" or "rename" to choose (or change) the switch mode explicitly
     * @param string|null $adopt "move": the first release may move the files already in the document root
     * @return array<string,mixed>
     */
    public function release(string $id, string $sha256, Closure $prepare, ?bool $symlinks = null, ?string $mode = null, ?string $adopt = null): array
    {
        $started = hrtime(true);
        $timings = [];
        $this->validateId($id);
        $sha256 = strtolower(trim($sha256));
        if (preg_match('/^[0-9a-f]{64}$/', $sha256) !== 1) {
            throw new ReleaseException('invalid_request', 'sha256 must be 64 hexadecimal characters.', 422);
        }
        if ($mode !== null && !in_array($mode, ['symlink', 'rename'], true)) {
            throw new ReleaseException('invalid_request', 'mode must be "symlink" or "rename".', 422);
        }
        if ($adopt !== null && $adopt !== 'move') {
            throw new ReleaseException('invalid_request', 'adopt must be "move".', 422);
        }
        $this->requireLayout();
        $state = $this->state();

        if ($state['current'] === $id && $this->releaseIntact($id)) {
            $this->cleanupIncoming($id);
            return ['release' => $id, 'already_current' => true, 'mode' => $state['mode'], 'previous' => $state['fallback']];
        }
        // Never hide a live site silently: a first release onto a document root with a site in it must be
        // asked for with adopt=move, after a human has seen the list (capabilities: adopt_candidates).
        if ($state['current'] === null) {
            $candidates = $this->adoptCandidates();
            if ($candidates !== [] && $adopt !== 'move') {
                throw new ReleaseException('adopt_required', 'The document root already holds a site; the first release must be sent with "adopt":"move".', 409, ['adopt_candidates' => $candidates]);
            }
        }

        // 1. The archive: present, under the size cap, the checksum the workflow computed.
        $archive = $this->deployDir . '/incoming/' . $id . '.zip';
        if (!is_file($archive)) {
            throw new ReleaseException('archive_not_found', 'The release archive was not uploaded (incoming/' . $id . '.zip is missing).', 422);
        }
        $bytes = (int) filesize($archive);
        if ($bytes <= 0 || $bytes > $this->maxArchiveBytes) {
            throw new ReleaseException('archive_too_large', 'The release archive is empty or larger than the limit.', 413, ['bytes' => $bytes, 'max_bytes' => $this->maxArchiveBytes]);
        }
        $manifest = $this->readJson($this->deployDir . '/incoming/' . $id . '.json');
        if ($manifest !== null && isset($manifest['sha256']) && strtolower((string) $manifest['sha256']) !== $sha256) {
            throw new ReleaseException('checksum_mismatch', 'The uploaded manifest names a different checksum than the request.', 422);
        }
        $actual = (string) hash_file('sha256', $archive);
        if (!hash_equals($sha256, $actual)) {
            throw new ReleaseException('checksum_mismatch', 'The uploaded archive does not match its SHA-256 (incomplete or corrupted upload).', 422, ['bytes' => $bytes]);
        }
        $timings['verify'] = $this->ms($started);

        // 2. Unpack into releases/<id> (a fresh folder; an old copy of the same id is replaced unless it is live).
        $t = hrtime(true);
        $dir = $this->releaseDir($id);
        $reused = false;
        $meta = $this->readJson($dir . '/release.json');
        if ($meta !== null && ($meta['sha256'] ?? null) === $sha256 && $this->releaseIntact($id)) {
            $reused = true;
            $stats = is_array($meta['unpacked'] ?? null) ? $meta['unpacked'] : [];
        } else {
            if (file_exists($dir)) {
                if (in_array($id, [$state['current'], $state['fallback']], true)) {
                    throw new ReleaseException('release_conflict', 'A different release with this id is live.', 409);
                }
                $this->removeTree($dir);
            }
            $stats = $this->unpack($archive, $id, $sha256, $manifest);
        }
        $timings['extract'] = $this->ms($t);

        // 3. The release's own after-unpack step (migrations, environment checks). Nothing is switched yet.
        $t = hrtime(true);
        try {
            $this->checkRootNames($this->rootNames($id));
            $prepared = $prepare([
                'release' => $id,
                'previous' => $state['current'],
                'first_release' => $state['current'] === null,
                'release_dir' => $dir,
                'app_dir' => $dir . '/app',
                'public_dir' => $this->treeOf($id) ?? $dir . '/public_html',
            ]);
        } catch (Throwable $exception) {
            if (!$reused) {
                $this->removeTree($dir);
            }
            throw $exception instanceof ReleaseException ? $exception : new ReleaseException('after_unpack_failed', 'after-unpack failed: ' . $exception::class, 500);
        }
        $timings['after_unpack'] = $this->ms($t);

        // 4. Switch.
        $t = hrtime(true);
        $state = $this->state();
        $previous = $state['current'];
        $chosen = $this->chooseMode($state, $symlinks, $mode);
        $rootNames = $this->rootNames($id);
        $legacy = $state['legacy'];
        if ($previous === null) {
            [$installed, $legacy] = $this->switchFirst($id, $chosen, $rootNames, $state);
        } else {
            try {
                // Root files (.htaccess last), then current.json (a front controller), then _current (the site).
                $installed = $this->installRootFiles($id, $state['root_files']);
                $this->writeCurrent($id);
                $this->switchTree($id, $previous, $chosen);
            } catch (ReleaseException $exception) {
                $this->revertSwitch($id, $previous, $state);
                throw $exception;
            }
        }
        $now = ($this->clock)();
        $state['legacy'] = $legacy;
        $state['mode'] = $chosen;
        $state['current'] = $id;
        $state['fallback'] = $previous;
        $state['root_files'] = $installed['files'];
        $state['releases'] = array_values(array_filter($state['releases'], static fn (array $release): bool => $release['id'] !== $id));
        $state['releases'][] = ['id' => $id, 'sha256' => $sha256, 'git_sha' => $this->gitSha($manifest), 'deployed_at' => gmdate(DATE_ATOM, $now), 'rolled_back' => false];
        $this->saveState($state);
        $timings['switch'] = $this->ms($t);

        // 5. Tidy up.
        $t = hrtime(true);
        $this->linkCurrentApp($id);
        $this->cleanupProbes();
        $pruned = $this->prune();
        $this->cleanupIncoming($id);
        $timings['tidy'] = $this->ms($t);
        $timings['total'] = $this->ms($started);

        return [
            'release' => $id,
            'previous' => $previous,
            'mode' => $chosen,
            'first_release' => $previous === null,
            'archive' => ['bytes' => $bytes, 'sha256_verified' => true, 'reused' => $reused] + $stats,
            'root_files' => $installed,
            'legacy' => $previous === null ? ($this->legacySummary(['legacy' => $legacy]) ?? []) + ['moved' => $legacy['entries'] ?? [], 'not_moved' => $legacy['not_moved'] ?? []] : null,
            'pruned' => $pruned,
            'kept' => array_column($this->state()['releases'], 'id'),
            'timings_ms' => $timings,
        ] + $prepared;
    }

    /**
     * The first release on this document root. The old site keeps answering until the release's .htaccess
     * is renamed into place (that rename is the switch); then its files move to legacy/<time>/. Nothing is
     * deleted, and a rollback puts every moved name back.
     *
     * @param list<string> $rootNames
     * @param array<string,mixed> $state
     * @return array{0:array{files:list<string>,preserved_cpanel_blocks:int,csp_hashes:int},1:array<string,mixed>}
     */
    private function switchFirst(string $id, string $mode, array $rootNames, array $state): array
    {
        $legacy = $this->startLegacy();
        $state['legacy'] = $legacy;
        $this->saveState($state); // the legacy folder is on record even if this request dies half-way
        $candidates = $this->adoptCandidates();
        $moved = [];
        try {
            // _current appears next to the old site; the old .htaccess knows nothing about it.
            $this->switchTree($id, null, $mode);
            $this->writeCurrent($id);
            // Names the release's root files need move first, so a release never writes into the old site's folders.
            $moved = $this->moveIntoLegacy(array_values(array_intersect($candidates, $rootNames)), (string) $legacy['dir'], true);
            $installed = $this->installRootFiles($id, []);
        } catch (ReleaseException $exception) {
            $this->revertFirst($id, $legacy, $moved);
            throw $exception;
        }
        $moved = [...$moved, ...$this->moveIntoLegacy(array_values(array_diff($candidates, $moved)), (string) $legacy['dir'], false)];
        sort($moved, SORT_STRING);
        $legacy['entries'] = $moved;
        $legacy['not_moved'] = array_values(array_diff($candidates, $moved));
        $legacy['restorable'] = true;
        return [$installed, $legacy];
    }

    /**
     * A first switch that failed half-way: the old site's names, its .htaccess, and no release slots.
     *
     * @param array<string,mixed> $legacy
     * @param list<string> $moved
     */
    private function revertFirst(string $id, array $legacy, array $moved): void
    {
        try {
            foreach ($this->rootNames($id) as $name) {
                $path = $this->docroot . '/' . $name;
                if (file_exists($path) || is_link($path)) {
                    $this->moveAside($path, 'root-' . $name);
                }
            }
            foreach ($moved as $name) {
                @rename($this->deployDir . '/' . $legacy['dir'] . '/public_html/' . $name, $this->docroot . '/' . $name);
            }
            $old = ($legacy['had_htaccess'] ?? false) ? @file_get_contents($this->deployDir . '/' . $legacy['dir'] . '/root/.htaccess') : false;
            if ($old !== false) {
                $this->writeAtomic($this->docroot . '/.htaccess', $old, 0644);
            } elseif (is_file($this->docroot . '/.htaccess')) {
                $this->moveAside($this->docroot . '/.htaccess', 'htaccess');
            }
            @unlink($this->deployDir . '/current.json');
            foreach (['_current', '_previous'] as $slot) {
                $this->clearSlot($slot, $this->slot($slot));
            }
            $state = $this->state();
            $state['legacy'] = null;
            $this->saveState($state);
            if ($this->topLevelNames($this->deployDir . '/' . $legacy['dir'] . '/public_html') === []) {
                $this->removeTree($this->deployDir . '/' . $legacy['dir']);
                @rmdir($this->deployDir . '/legacy');
            }
        } catch (Throwable) {
            // Best effort: the original error is the one reported.
        }
    }

    /**
     * A later switch that failed half-way: the release before gets its root files, current.json and tree back.
     *
     * @param array<string,mixed> $state the state before the switch
     */
    private function revertSwitch(string $failed, string $previous, array $state): void
    {
        try {
            $this->installRootFiles($previous, $this->rootFileList($failed));
            $this->writeCurrent($previous);
            $this->switchTree($previous, $state['fallback'], $state['mode'] ?? 'rename');
        } catch (ReleaseException) {
            // Best effort: the original error is the one reported.
        }
    }

    /**
     * The live release passed the smoke test. The newest confirmed release that was not rolled back is never
     * pruned, so there is always a known-good release on the server to roll back to.
     *
     * @return array<string,mixed>
     */
    public function confirm(string $id): array
    {
        $this->validateId($id);
        $this->requireLayout();
        $state = $this->state();
        if ($state['current'] !== $id || !$this->releaseIntact($id)) {
            throw new ReleaseException('not_current', 'Only the live release can be confirmed.', 409, ['current' => $state['current']]);
        }
        $before = $this->lastGood($state);
        foreach ($state['releases'] as &$release) {
            if ($release['id'] === $id) {
                $release['confirmed_at'] = gmdate(DATE_ATOM, ($this->clock)());
            }
        }
        unset($release);
        $this->saveState($state);
        return ['release' => $id, 'confirmed' => true, 'confirmed_before' => $before];
    }

    /* ───────────── rollback ───────────── */

    /**
     * Switches back to the release before the current one, to $to, or to "legacy" (the site that was there
     * before the first release). Nothing is unpacked and nothing of the release's own code runs.
     *
     * @return array<string,mixed>
     */
    public function rollback(?string $to = null): array
    {
        $started = hrtime(true);
        $this->requireLayout();
        $state = $this->state();
        $current = $state['current'];
        if ($current === null) {
            throw new ReleaseException('no_previous_release', 'The site is not served from a release: there is nothing to roll back.', 409);
        }
        if ($to === 'legacy') {
            if (!$this->legacyRestorable($state)) {
                throw new ReleaseException('rollback_target_missing', 'There is no site from before the first release to restore.', 409);
            }
            return $this->restoreLegacy($started);
        }
        if ($to !== null) {
            $this->validateId($to);
            if ($to === $current || !in_array($to, array_column($state['releases'], 'id'), true) || !$this->releaseIntact($to)) {
                throw new ReleaseException('rollback_target_missing', 'That release is not kept on the server (or is the live one).', 409);
            }
            $target = $to;
        } else {
            $target = $this->rollbackTarget($state);
            if ($target === null) {
                if ($this->legacyRestorable($state)) {
                    return $this->restoreLegacy($started);
                }
                throw new ReleaseException('no_previous_release', 'There is no earlier release on the server to roll back to.', 409);
            }
        }

        $mode = $state['mode'] ?? 'rename';
        $installed = $this->installRootFiles($target, $state['root_files']);
        $this->writeCurrent($target);
        $this->switchTree($target, $current, $mode);
        foreach ($state['releases'] as &$release) {
            if ($release['id'] === $current) {
                $release['rolled_back'] = true;
            } elseif ($release['id'] === $target) {
                $release['rolled_back'] = false;
            }
        }
        unset($release);
        $state['current'] = $target;
        $state['fallback'] = $current;
        $state['root_files'] = $installed['files'];
        $this->saveState($state);
        $this->linkCurrentApp($target);
        return [
            'rolled_back_from' => $current,
            'release' => $target,
            'mode' => $mode,
            'root_files' => $installed,
            'timings_ms' => ['total' => $this->ms($started)],
        ];
    }

    /* ───────────── state ───────────── */

    /** @return array{version:int,mode:?string,current:?string,fallback:?string,releases:list<array<string,mixed>>,root_files:list<string>,legacy:?array<string,mixed>} */
    public function state(): array
    {
        $state = $this->readJson($this->deployDir . '/state.json') ?? [];
        $id = static fn (mixed $value): ?string => is_string($value) && preg_match(self::ID_PATTERN, $value) === 1 ? $value : null;
        return [
            'version' => 1,
            'mode' => in_array($state['mode'] ?? null, ['symlink', 'rename'], true) ? $state['mode'] : null,
            'current' => $id($state['current'] ?? null),
            'fallback' => $id($state['fallback'] ?? null),
            'releases' => array_values(array_filter(is_array($state['releases'] ?? null) ? $state['releases'] : [], static fn ($release): bool => is_array($release) && is_string($release['id'] ?? null) && preg_match(self::ID_PATTERN, $release['id']) === 1)),
            'root_files' => array_values(array_filter(is_array($state['root_files'] ?? null) ? $state['root_files'] : [], fn ($file): bool => is_string($file) && $this->safeRelative($file))),
            'legacy' => is_array($state['legacy'] ?? null) && is_string($state['legacy']['dir'] ?? null) && preg_match('#^legacy/[0-9TZ-]+[0-9a-f-]*$#', $state['legacy']['dir']) === 1 ? $state['legacy'] : null,
        ];
    }

    /** @param array<string,mixed> $state */
    private function saveState(array $state): void
    {
        $state['updated_at'] = gmdate(DATE_ATOM, ($this->clock)());
        $this->writeAtomic($this->deployDir . '/state.json', json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
    }

    /** @param array<string,mixed> $state */
    private function rollbackTarget(array $state): ?string
    {
        $ids = array_column($state['releases'], 'id');
        $position = $state['current'] === null ? false : array_search($state['current'], $ids, true);
        if ($position === false) {
            return null;
        }
        for ($i = $position - 1; $i >= 0; $i--) {
            $release = $state['releases'][$i];
            if (($release['rolled_back'] ?? false) !== true && $this->releaseIntact($release['id'])) {
                return $release['id'];
            }
        }
        return null;
    }

    /** The newest release that passed its smoke test (confirm) and was not rolled back since. @param array<string,mixed> $state */
    private function lastGood(array $state): ?string
    {
        foreach (array_reverse($state['releases']) as $release) {
            if (isset($release['confirmed_at']) && ($release['rolled_back'] ?? false) !== true) {
                return $release['id'];
            }
        }
        return null;
    }

    /** @param array<string,mixed> $state */
    private function legacyRestorable(array $state): bool
    {
        return is_array($state['legacy']) && ($state['legacy']['restorable'] ?? false) === true && is_dir($this->deployDir . '/' . $state['legacy']['dir'] . '/public_html');
    }

    /** @param array<string,mixed> $state @return array<string,mixed>|null */
    private function legacySummary(array $state): ?array
    {
        $legacy = $state['legacy'] ?? null;
        if (!is_array($legacy)) {
            return null;
        }
        return ['dir' => $this->relative($this->home, $this->deployDir . '/' . $legacy['dir']), 'entries' => count($legacy['entries'] ?? []), 'restorable' => ($legacy['restorable'] ?? false) === true];
    }

    /* ───────────── unpacking ───────────── */

    /** @param array<string,mixed>|null $manifest @return array<string,mixed> */
    private function unpack(string $archive, string $id, string $sha256, ?array $manifest): array
    {
        $releases = $this->deployDir . '/releases';
        $this->mkdir($releases);
        $staging = $releases . '/.partial-' . $id . '-' . bin2hex(random_bytes(4));
        try {
            $stats = ArchiveExtractor::extract($archive, $staging);
            $this->mkdir($staging . '/public_html');
            // The marker tells .htaccess (and a rename-mode switch) which tree a slot holds.
            $this->writeFile($staging . '/public_html/' . self::MARKER, $id);
            $meta = [
                'id' => $id,
                'sha256' => $sha256,
                'git_sha' => $this->gitSha($manifest),
                'unpacked_at' => gmdate(DATE_ATOM, ($this->clock)()),
                'unpacked' => $stats,
                // Relative, so it survives a home-folder move: where .env and storage live for this app.
                'app_home' => $this->relative($this->releaseDir($id), $this->appHome),
            ];
            $this->writeFile($staging . '/release.json', json_encode($meta, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n");
            $this->rename($staging, $this->releaseDir($id));
        } catch (ReleaseException $exception) {
            $this->removeTree($staging);
            throw $exception;
        }
        return $stats;
    }

    private function releaseDir(string $id): string
    {
        return $this->deployDir . '/releases/' . $id;
    }

    /** A kept release whose public tree (parked or checked out) is where it should be. */
    private function releaseIntact(string $id): bool
    {
        if (preg_match(self::ID_PATTERN, $id) !== 1 || !is_file($this->releaseDir($id) . '/release.json')) {
            return false;
        }
        $tree = $this->treeOf($id);
        return $tree !== null && is_file($tree . '/' . self::MARKER);
    }

    /* ───────────── root files ───────────── */

    /** @return list<string> top-level names root/ installs into the document root (besides .htaccess) */
    private function rootNames(string $id): array
    {
        return array_values(array_diff($this->topLevelNames($this->releaseDir($id) . '/root'), ['.htaccess']));
    }

    /** @return list<string> */
    private function rootFileList(string $id): array
    {
        return array_values(array_filter($this->listFiles($this->releaseDir($id) . '/root'), static fn (string $file): bool => $file !== '.htaccess'));
    }

    /** @param list<string> $names */
    private function checkRootNames(array $names): void
    {
        foreach ($names as $name) {
            if (in_array($name, self::PERSISTENT, true) || in_array($name, $this->keep, true)) {
                throw new ReleaseException('root_conflict', 'root/' . $name . ' would replace a name the deploy keeps in place (persistent or DEPLOY_KEEP).', 409, ['name' => $name]);
            }
        }
    }

    /**
     * Installs the release's root/ into the real document root, each file with one rename(): every other
     * file first and the .htaccess LAST (for a first release, that rename is the switch). The .htaccess
     * keeps cPanel's blocks from the live file. Files the release before installed and this one lacks go.
     *
     * @param list<string> $previousFiles
     * @return array{files:list<string>,preserved_cpanel_blocks:int,csp_hashes:int}
     */
    private function installRootFiles(string $id, array $previousFiles): array
    {
        $root = $this->releaseDir($id) . '/root';
        $release = @file_get_contents($root . '/.htaccess');
        if ($release === false) {
            throw new ReleaseException('release_incomplete', 'The release has no root/.htaccess to install.', 500);
        }
        $files = $this->rootFileList($id);
        foreach ($files as $relative) {
            $contents = @file_get_contents($root . '/' . $relative);
            if ($contents === false) {
                throw new ReleaseException('release_incomplete', 'The release root/ folder is unreadable.', 500);
            }
            $target = $this->docroot . '/' . $relative;
            $this->mkdir(dirname($target));
            $this->requireInsideDocroot(dirname($target));
            $this->writeAtomic($target, $contents, 0644);
        }

        $live = is_file($this->docroot . '/.htaccess') ? (string) @file_get_contents($this->docroot . '/.htaccess') : null;
        $hashes = [];
        foreach (array_column($this->state()['releases'], 'id') as $kept) {
            $copy = @file_get_contents($this->releaseDir($kept) . '/root/.htaccess');
            if ($copy !== false) {
                $hashes = [...$hashes, ...HtaccessComposer::scriptHashes($copy)];
            }
        }
        $composed = HtaccessComposer::compose($release, $live, array_values(array_unique($hashes)));
        if ($live !== null && $live !== $composed) {
            $this->mkdir($this->deployDir . '/backup');
            @copy($this->docroot . '/.htaccess', $this->deployDir . '/backup/htaccess.before-' . $id . '-' . gmdate('Ymd\THis\Z', ($this->clock)()));
            $this->trimBackups();
        }
        $this->writeAtomic($this->docroot . '/.htaccess', $composed, 0644);
        $this->removeRootFiles(array_values(array_diff($previousFiles, $files)));
        return [
            'files' => $files,
            'preserved_cpanel_blocks' => $live === null ? 0 : count(HtaccessComposer::cpanelBlocks($live, $release)),
            'csp_hashes' => count(HtaccessComposer::scriptHashes($composed)),
        ];
    }

    /** Removes root files a release installed (plain files only), and the folders that are empty after. @param list<string> $files */
    private function removeRootFiles(array $files): void
    {
        foreach ($files as $relative) {
            if (!$this->safeRelative($relative) || $relative === '.htaccess') {
                continue;
            }
            $path = $this->docroot . '/' . $relative;
            if (is_file($path) && !is_link($path)) {
                @unlink($path);
            }
            $dir = dirname($path);
            while (str_starts_with($dir, $this->docroot . '/') && is_dir($dir) && !is_link($dir) && $this->topLevelNames($dir) === []) {
                @rmdir($dir);
                $dir = dirname($dir);
            }
        }
    }

    private function writeCurrent(string $id): void
    {
        $this->writeAtomic($this->deployDir . '/current.json', json_encode(['release' => $id, 'switched_at' => gmdate(DATE_ATOM, ($this->clock)())], JSON_UNESCAPED_SLASHES) . "\n", 0644);
    }

    /* ───────────── the switch ───────────── */

    /** @param array<string,mixed> $state */
    private function chooseMode(array $state, ?bool $symlinks, ?string $requested): string
    {
        $wanted = $requested ?? $state['mode'] ?? ($symlinks === true ? 'symlink' : 'rename');
        return $wanted === 'symlink' && $this->canSymlink() ? 'symlink' : 'rename';
    }

    /** Makes _current hold $current and _previous hold $fallback (or nothing), in the given mode. */
    public function switchTree(string $current, ?string $fallback, string $mode): void
    {
        if ($fallback === $current) {
            $fallback = null;
        }
        $mode === 'symlink' ? $this->switchSymlinks($current, $fallback) : $this->switchRenames($current, $fallback);
    }

    private function switchSymlinks(string $current, ?string $fallback): void
    {
        $cur = $this->slot('_current');
        $prev = $this->slot('_previous');
        // Leaving the rename mode: the live folder moves to _previous (which .htaccess serves while _current is missing).
        if ($cur['type'] === 'dir') {
            $this->clearSlot('_previous', $prev);
            $this->rename($this->docroot . '/_current', $this->docroot . '/_previous');
            $prev = ['type' => 'dir', 'id' => $cur['id']];
        }
        if ($prev['type'] === 'dir' && $prev['id'] === $current) {
            $this->park('_previous', $current);
            $prev = ['type' => 'none', 'id' => null];
        }
        if ($prev['type'] === 'dir') {
            // Link the new release first, so a tree is always served, then park the folder.
            $this->link('_current', $current);
            $this->park('_previous', (string) $prev['id']);
        }
        // _previous first (the tree that stops being live keeps serving its hashed assets), then _current.
        if ($fallback !== null && is_dir($this->releaseDir($fallback) . '/public_html')) {
            $this->link('_previous', $fallback);
        } elseif (is_link($this->docroot . '/_previous')) {
            @unlink($this->docroot . '/_previous');
        }
        $this->link('_current', $current);
    }

    private function switchRenames(string $current, ?string $fallback): void
    {
        $cur = $this->slot('_current');
        $prev = $this->slot('_previous');
        if ($prev['type'] === 'link' || ($prev['type'] === 'dir' && $prev['id'] !== $fallback)) {
            $this->clearSlot('_previous', $prev);
            $prev = ['type' => 'none', 'id' => null];
        }
        if ($cur['type'] === 'link') {
            if ($prev['type'] === 'none' && $fallback !== null && $this->parked($fallback)) {
                $this->rename($this->releaseDir($fallback) . '/public_html', $this->docroot . '/_previous');
                $prev = ['type' => 'dir', 'id' => $fallback];
            }
            @unlink($this->docroot . '/_current');
            $cur = ['type' => 'none', 'id' => null];
        } elseif ($cur['type'] === 'dir' && $cur['id'] !== $current) {
            if ($cur['id'] === $fallback && $prev['type'] === 'none') {
                // The live tree becomes _previous; .htaccess serves it until the new one is in place.
                $this->rename($this->docroot . '/_current', $this->docroot . '/_previous');
                $prev = ['type' => 'dir', 'id' => $fallback];
            } else {
                $this->park('_current', $cur['id']);
            }
            $cur = ['type' => 'none', 'id' => null];
        }
        if ($prev['type'] === 'none' && $fallback !== null && $this->parked($fallback)) {
            $this->rename($this->releaseDir($fallback) . '/public_html', $this->docroot . '/_previous');
        }
        if ($cur['type'] === 'none') {
            if (!$this->parked($current)) {
                throw new ReleaseException('switch_failed', 'The release files are not where they should be.', 500);
            }
            $this->rename($this->releaseDir($current) . '/public_html', $this->docroot . '/_current');
        }
    }

    /** @return array{type:'none'|'link'|'dir',id:?string} */
    private function slot(string $slot): array
    {
        $path = $this->docroot . '/' . $slot;
        clearstatcache(true, $path);
        if (is_link($path)) {
            $target = (string) @readlink($path);
            return ['type' => 'link', 'id' => preg_match('#releases/([^/]+)/public_html/?$#', $target, $match) === 1 ? $match[1] : null];
        }
        if (is_dir($path)) {
            $marker = @file_get_contents($path . '/' . self::MARKER);
            return ['type' => 'dir', 'id' => is_string($marker) && preg_match(self::ID_PATTERN, trim($marker)) === 1 ? trim($marker) : null];
        }
        return ['type' => 'none', 'id' => null];
    }

    /** @param array{type:string,id:?string} $holder */
    private function clearSlot(string $slot, array $holder): void
    {
        if ($holder['type'] === 'link') {
            @unlink($this->docroot . '/' . $slot);
        } elseif ($holder['type'] === 'dir') {
            $this->park($slot, $holder['id']);
        }
    }

    /** Moves a checked-out folder back to releases/<id>/public_html (or aside, if its release is gone). */
    private function park(string $slot, ?string $id): void
    {
        if ($id !== null && is_dir($this->releaseDir($id)) && !file_exists($this->releaseDir($id) . '/public_html')) {
            $this->rename($this->docroot . '/' . $slot, $this->releaseDir($id) . '/public_html');
            return;
        }
        $this->moveAside($this->docroot . '/' . $slot, $slot);
    }

    /** Moves something out of the document root into orphans/ (never deletes it). */
    private function moveAside(string $path, string $label): void
    {
        $target = $this->deployDir . '/orphans/' . trim($label, '._') . '-' . gmdate('Ymd\THis\Z', ($this->clock)()) . '-' . bin2hex(random_bytes(3));
        $this->mkdir(dirname($target));
        $this->rename($path, $target);
    }

    /** Where a release's public tree is now: parked in releases/<id>/, or checked out as a real folder. */
    private function treeOf(string $id): ?string
    {
        if ($this->parked($id)) {
            return $this->releaseDir($id) . '/public_html';
        }
        foreach (['_current', '_previous'] as $slot) {
            $holder = $this->slot($slot);
            if ($holder['type'] === 'dir' && $holder['id'] === $id) {
                return $this->docroot . '/' . $slot;
            }
        }
        return null;
    }

    private function parked(string $id): bool
    {
        return is_dir($this->releaseDir($id) . '/public_html');
    }

    /** Points the document root's <slot> at releases/<id>/public_html: a new symlink renamed over the old one (atomic). */
    private function link(string $slot, string $id): void
    {
        $path = $this->docroot . '/' . $slot;
        $target = $this->relative($this->docroot, $this->releaseDir($id) . '/public_html');
        if (is_link($path) && readlink($path) === $target) {
            return;
        }
        $temporary = $this->docroot . '/.' . ltrim($slot, '_') . '.' . bin2hex(random_bytes(4));
        if (!@symlink($target, $temporary)) {
            throw new ReleaseException('switch_failed', 'Could not create the ' . $slot . ' symlink.', 500);
        }
        if (!@rename($temporary, $path)) {
            @unlink($temporary);
            throw new ReleaseException('switch_failed', 'Could not switch the ' . $slot . ' symlink.', 500);
        }
    }

    private function linkCurrentApp(string $id): void
    {
        $path = $this->deployDir . '/current-app';
        if (!is_dir($this->releaseDir($id) . '/app')) {
            if (is_link($path)) {
                @unlink($path);
            }
            return;
        }
        if (!$this->canSymlink()) {
            return;
        }
        $temporary = $this->deployDir . '/.current-app.' . bin2hex(random_bytes(4));
        if (@symlink('releases/' . $id . '/app', $temporary) && !@rename($temporary, $path)) {
            @unlink($temporary);
        }
    }

    /* ───────────── the site that was there before (adopt and legacy) ───────────── */

    /**
     * Top-level names in the document root the first release would move to legacy/: everything except the
     * persistent names, DEPLOY_KEEP and the switch's own temporary names.
     *
     * @return list<string>
     */
    public function adoptCandidates(): array
    {
        $names = [];
        foreach ($this->topLevelNames($this->docroot) as $name) {
            if (in_array($name, self::PERSISTENT, true) || in_array($name, $this->keep, true) || $this->temporaryName($name)) {
                continue;
            }
            $names[] = $name;
        }
        sort($names, SORT_STRING);
        return $names;
    }

    /** @return list<string> */
    private function keptInPlace(): array
    {
        $names = array_values(array_filter($this->topLevelNames($this->docroot), fn (string $name): bool => in_array($name, self::PERSISTENT, true) || in_array($name, $this->keep, true)));
        sort($names, SORT_STRING);
        return $names;
    }

    /** A folder named like a domain is often another site's document root (an addon domain or subdomain). */
    private function looksLikeAnotherSite(string $name): bool
    {
        return is_dir($this->docroot . '/' . $name) && preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i', $name) === 1;
    }

    private function temporaryName(string $name): bool
    {
        return preg_match('/^\.(?:current|previous)\.[0-9a-f]{8}$/', $name) === 1 || preg_match('/^\..+\.[0-9a-f]{8}\.tmp$/', $name) === 1;
    }

    /** @return array<string,mixed> the legacy record, with a copy of the live .htaccess taken */
    private function startLegacy(): array
    {
        $dir = 'legacy/' . gmdate('Ymd\THis\Z', ($this->clock)());
        if (file_exists($this->deployDir . '/' . $dir)) {
            $dir .= '-' . bin2hex(random_bytes(2));
        }
        $this->mkdir($this->deployDir . '/' . $dir . '/public_html');
        $this->mkdir($this->deployDir . '/' . $dir . '/root');
        $hadHtaccess = is_file($this->docroot . '/.htaccess');
        if ($hadHtaccess && !@copy($this->docroot . '/.htaccess', $this->deployDir . '/' . $dir . '/root/.htaccess')) {
            throw new ReleaseException('write_failed', 'Could not back up the live .htaccess.', 500);
        }
        return ['dir' => $dir, 'entries' => [], 'not_moved' => [], 'had_htaccess' => $hadHtaccess, 'restorable' => false, 'created_at' => gmdate(DATE_ATOM, ($this->clock)())];
    }

    /** @param list<string> $names @return list<string> the names moved */
    private function moveIntoLegacy(array $names, string $dir, bool $strict): array
    {
        $target = $this->deployDir . '/' . $dir . '/public_html';
        $moved = [];
        foreach ($names as $name) {
            $from = $this->docroot . '/' . $name;
            if (!self::plainName($name) || (!file_exists($from) && !is_link($from))) {
                continue;
            }
            if (@rename($from, $target . '/' . $name)) {
                $moved[] = $name;
            } elseif ($strict) {
                throw new ReleaseException('switch_failed', 'Could not move ' . $name . ' out of the way for the release.', 500);
            }
        }
        return $moved;
    }

    /** @return array<string,mixed> */
    private function restoreLegacy(int|float $started): array
    {
        $state = $this->state();
        $legacy = (array) $state['legacy'];
        $dir = $this->deployDir . '/' . $legacy['dir'];
        // 1. The release's root files leave first: the old site's folders may need their names back.
        $this->removeRootFiles($state['root_files']);
        // 2. The old site's files come back (the release's .htaccess still routes to _current meanwhile).
        $restored = [];
        $notRestored = [];
        foreach (is_array($legacy['entries'] ?? null) ? $legacy['entries'] : [] as $name) {
            if (!is_string($name) || !self::plainName($name)) {
                continue;
            }
            $from = $dir . '/public_html/' . $name;
            $to = $this->docroot . '/' . $name;
            if ((file_exists($from) || is_link($from)) && !file_exists($to) && !is_link($to) && @rename($from, $to)) {
                $restored[] = $name;
            } else {
                $notRestored[] = $name;
            }
        }
        // 3. Its .htaccess, with the cPanel blocks that are live now: that rename is the switch back.
        $this->restoreHtaccess($dir, ($legacy['had_htaccess'] ?? false) === true);
        // 4. The release switch goes.
        @unlink($this->deployDir . '/current.json');
        foreach (['_current', '_previous'] as $slot) {
            $this->clearSlot($slot, $this->slot($slot));
        }
        if (is_link($this->deployDir . '/current-app')) {
            @unlink($this->deployDir . '/current-app');
        }
        $from = $state['current'];
        foreach ($state['releases'] as &$release) {
            if ($release['id'] === $from) {
                $release['rolled_back'] = true;
            }
        }
        unset($release);
        $state['current'] = null;
        $state['fallback'] = null;
        $state['root_files'] = [];
        $state['legacy'] = null;
        $this->saveState($state);
        // The legacy folder goes only once it is empty (everything went back); otherwise it stays for you.
        $kept = $notRestored !== [] || $this->topLevelNames($dir . '/public_html') !== [];
        if (!$kept) {
            $this->removeTree($dir);
            @rmdir($this->deployDir . '/legacy');
        }
        sort($restored, SORT_STRING);
        return [
            'rolled_back_from' => $from,
            'release' => null,
            'restored' => 'the site from before the first release',
            'entries' => $restored,
            'not_restored' => $notRestored,
            'legacy_dir_kept' => $kept ? $this->relative($this->home, $dir) : null,
            'timings_ms' => ['total' => $this->ms($started)],
        ];
    }

    private function restoreHtaccess(string $dir, bool $hadHtaccess): void
    {
        $file = $this->docroot . '/.htaccess';
        $live = is_file($file) ? (string) @file_get_contents($file) : null;
        $old = $hadHtaccess ? @file_get_contents($dir . '/root/.htaccess') : false;
        if ($old !== false) {
            $this->writeAtomic($file, HtaccessComposer::refreshCpanelBlocks($old, $live), 0644);
            return;
        }
        if ($live === null) {
            return;
        }
        $blocks = HtaccessComposer::cpanelBlocks($live, '');
        if ($blocks !== []) {
            $this->writeAtomic($file, implode("\n", $blocks) . "\n", 0644);
            return;
        }
        // There was no .htaccess before the first release: the release's one goes to backup/, not the bin.
        $this->mkdir($this->deployDir . '/backup');
        $this->rename($file, $this->deployDir . '/backup/htaccess.removed-' . gmdate('Ymd\THis\Z', ($this->clock)()));
    }

    /* ───────────── tidying ───────────── */

    /** Keeps the live release, the one before it, the newest confirmed one and the newest others up to KEEP. @return list<string> */
    private function prune(): array
    {
        $state = $this->state();
        $keep = array_values(array_unique(array_filter([$state['current'], $state['fallback'], $this->lastGood($state)])));
        foreach ([true, false] as $healthyOnly) {
            foreach (array_reverse($state['releases']) as $release) {
                if (count($keep) >= self::KEEP) {
                    break 2;
                }
                if (!in_array($release['id'], $keep, true) && (!$healthyOnly || ($release['rolled_back'] ?? false) !== true)) {
                    $keep[] = $release['id'];
                }
            }
        }
        $pruned = [];
        $state['releases'] = array_values(array_filter($state['releases'], function (array $release) use ($keep, &$pruned): bool {
            if (in_array($release['id'], $keep, true)) {
                return true;
            }
            $this->removeTree($this->releaseDir($release['id']));
            $pruned[] = $release['id'];
            return false;
        }));
        // Leftovers: interrupted unpacks and folders no state entry names.
        foreach ($this->topLevelNames($this->deployDir . '/releases') as $name) {
            if (str_starts_with($name, '.partial-') || (preg_match(self::ID_PATTERN, $name) === 1 && !in_array($name, array_column($state['releases'], 'id'), true))) {
                $this->removeTree($this->deployDir . '/releases/' . $name);
            }
        }
        $this->saveState($state);
        return $pruned;
    }

    private function cleanupIncoming(string $id): void
    {
        $incoming = $this->deployDir . '/incoming';
        @unlink($incoming . '/' . $id . '.zip');
        @unlink($incoming . '/' . $id . '.json');
        // Uploads that never became a release (a failed run) go after a day.
        foreach ($this->topLevelNames($incoming) as $name) {
            $path = $incoming . '/' . $name;
            if (is_file($path) && (int) @filemtime($path) < ($this->clock)() - 86400) {
                @unlink($path);
            }
        }
    }

    private function cleanupProbes(): void
    {
        foreach ($this->topLevelNames($this->docroot . '/_deploy') as $name) {
            $path = $this->docroot . '/_deploy/' . $name;
            if (str_starts_with($name, 'probe-') && is_link($path)) {
                @unlink($path);
            }
        }
        foreach ($this->topLevelNames($this->deployDir . '/probe') as $name) {
            @unlink($this->deployDir . '/probe/' . $name);
        }
        @rmdir($this->deployDir . '/probe');
    }

    private function trimBackups(): void
    {
        $dir = $this->deployDir . '/backup';
        $files = array_values(array_filter($this->topLevelNames($dir), static fn (string $name): bool => str_starts_with($name, 'htaccess.before-')));
        usort($files, fn (string $a, string $b): int => (int) @filemtime($dir . '/' . $b) <=> (int) @filemtime($dir . '/' . $a) ?: strcmp($b, $a));
        foreach (array_slice($files, 5) as $old) {
            @unlink($dir . '/' . $old);
        }
    }

    /* ───────────── helpers ───────────── */

    private function requireLayout(): void
    {
        if (!is_dir($this->docroot)) {
            throw new ReleaseException('layout_unsupported', 'The document root folder was not found (check DOCROOT).', 409);
        }
        $this->mkdir($this->deployDir);
    }

    private function requireInsideDocroot(string $dir): void
    {
        $real = realpath($dir);
        $root = realpath($this->docroot);
        if ($real === false || $root === false || ($real !== $root && !str_starts_with($real, $root . '/'))) {
            throw new ReleaseException('root_conflict', 'A root/ file would be written outside the document root (a symlinked folder?).', 409);
        }
    }

    private function validateId(string $id): void
    {
        if (preg_match(self::ID_PATTERN, $id) !== 1 || str_contains($id, '..') || in_array(strtolower($id), self::RESERVED_IDS, true)) {
            throw new ReleaseException('invalid_request', 'release must be 1 to 80 letters, digits, dots, dashes or underscores.', 422);
        }
    }

    private function safeRelative(string $path): bool
    {
        if ($path === '' || str_starts_with($path, '/') || str_contains($path, "\0")) {
            return false;
        }
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return false;
            }
        }
        return true;
    }

    private function canSymlink(): bool
    {
        return $this->symlinkFunction ?? function_exists('symlink');
    }

    /** @param array<string,mixed>|null $manifest */
    private function gitSha(?array $manifest): ?string
    {
        $sha = is_array($manifest) ? strtolower((string) ($manifest['git_sha'] ?? '')) : '';
        return preg_match('/^[0-9a-f]{7,40}$/', $sha) === 1 ? $sha : null;
    }

    /** @return array<string,mixed>|null */
    private function readJson(string $path): ?array
    {
        if (!is_file($path)) {
            return null;
        }
        try {
            $decoded = json_decode((string) @file_get_contents($path), true, 32, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }
        return is_array($decoded) ? $decoded : null;
    }

    private function writeFile(string $path, string $contents): void
    {
        if (@file_put_contents($path, $contents) === false) {
            throw new ReleaseException('write_failed', 'Could not write ' . basename($path) . '.', 500);
        }
    }

    /** Writes a sibling temporary file and renames it over $path: readers see the old or the new file, never half. */
    private function writeAtomic(string $path, string $contents, int $mode = 0640): void
    {
        $temporary = dirname($path) . '/.' . basename($path) . '.' . bin2hex(random_bytes(4)) . '.tmp';
        if (@file_put_contents($temporary, $contents) === false) {
            throw new ReleaseException('write_failed', 'Could not write ' . basename($path) . '.', 500);
        }
        @chmod($temporary, $mode);
        if (!@rename($temporary, $path)) {
            @unlink($temporary);
            throw new ReleaseException('write_failed', 'Could not replace ' . basename($path) . '.', 500);
        }
    }

    private function rename(string $from, string $to): void
    {
        if (!@rename($from, $to)) {
            throw new ReleaseException('switch_failed', 'Could not move ' . basename($from) . ' to ' . basename($to) . '.', 500);
        }
    }

    private function mkdir(string $dir): void
    {
        if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new ReleaseException('write_failed', 'Could not create the ' . basename($dir) . ' folder.', 500);
        }
    }

    /** @return list<string> */
    private function topLevelNames(string $dir): array
    {
        $names = is_dir($dir) ? @scandir($dir) : false;
        return $names === false ? [] : array_values(array_diff($names, ['.', '..']));
    }

    /** @return list<string> files below $dir, relative (symlinks skipped) */
    private function listFiles(string $dir, string $prefix = ''): array
    {
        $files = [];
        foreach ($this->topLevelNames($dir) as $name) {
            $path = $dir . '/' . $name;
            if (is_link($path)) {
                continue;
            }
            if (is_dir($path)) {
                $files = [...$files, ...$this->listFiles($path, $prefix . $name . '/')];
            } elseif (is_file($path)) {
                $files[] = $prefix . $name;
            }
        }
        return $files;
    }

    /** Deletes a folder inside the deploy folder. Symlinks are removed, never followed. */
    private function removeTree(string $path): void
    {
        $base = rtrim($this->deployDir, '/') . '/';
        if (!str_starts_with($path, $base) || str_contains(substr($path, strlen($base)), '..')) {
            throw new ReleaseException('unsafe_delete', 'Refused to delete outside the deploy folder.', 500);
        }
        if (is_link($path) || is_file($path)) {
            @unlink($path);
            return;
        }
        if (!is_dir($path)) {
            return;
        }
        foreach ($this->topLevelNames($path) as $name) {
            $this->removeTree($path . '/' . $name);
        }
        @rmdir($path);
    }

    /** The relative path from folder $from to $to (both absolute). */
    private function relative(string $from, string $to): string
    {
        $fromParts = array_values(array_filter(explode('/', self::normalise($from)), 'strlen'));
        $toParts = array_values(array_filter(explode('/', self::normalise($to)), 'strlen'));
        $common = 0;
        while ($common < count($fromParts) && $common < count($toParts) && $fromParts[$common] === $toParts[$common]) {
            $common++;
        }
        $up = array_fill(0, count($fromParts) - $common, '..');
        $relative = implode('/', [...$up, ...array_slice($toParts, $common)]);
        return $relative === '' ? '.' : $relative;
    }

    /** Resolves "." and ".." segments without touching the filesystem (the target may not exist yet). */
    public static function normalise(string $path): string
    {
        $parts = [];
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }
            if ($part === '..') {
                array_pop($parts);
                continue;
            }
            $parts[] = $part;
        }
        return '/' . implode('/', $parts);
    }

    private function ms(int|float $since): float
    {
        return round((hrtime(true) - $since) / 1e6, 1);
    }
}
