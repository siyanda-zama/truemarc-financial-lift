<?php

declare(strict_types=1);

// Unit tests for the receiver's ported classes: php tests/unit.php <scratch-dir>
// Prints "ok - ..." / "not ok - ..." lines and a total; exits 1 on any failure.

use DeployKit\ArchiveExtractor;
use DeployKit\ClientIp;
use DeployKit\Env;
use DeployKit\HtaccessComposer;
use DeployKit\ReleaseException;
use DeployKit\ReleaseManager;

$receiver = dirname(__DIR__) . '/receiver';
foreach (['ReleaseException', 'Env', 'ClientIp', 'RateLimiter', 'ArchiveExtractor', 'HtaccessComposer', 'ReleaseManager', 'Hook'] as $class) {
    require_once $receiver . '/src/' . $class . '.php';
}
// A fresh folder per run: extraction refuses a target that already exists.
$work = rtrim($argv[1] ?? sys_get_temp_dir(), '/') . '/unit-' . getmypid() . '-' . bin2hex(random_bytes(3));
@mkdir($work, 0755, true);

$passed = 0;
$failed = 0;
$assert = static function (bool $condition, string $label) use (&$passed, &$failed): void {
    if ($condition) {
        $passed++;
        echo "ok - {$label}\n";
    } else {
        $failed++;
        echo "not ok - {$label}\n";
    }
};

$zip = static function (array $entries, ?int $eocdEntries = null) use ($work): string {
    $file = $work . '/z-' . bin2hex(random_bytes(4)) . '.zip';
    $spec = $eocdEntries === null ? $entries : ['entries' => $entries, 'eocd_entries' => $eocdEntries];
    $process = proc_open([PHP_BINARY, __DIR__ . '/make-zip.php', $file], [0 => ['pipe', 'r'], 1 => ['pipe', 'w']], $pipes);
    fwrite($pipes[0], (string) json_encode($spec));
    fclose($pipes[0]);
    stream_get_contents($pipes[1]);
    proc_close($process);
    return $file;
};
$valid = [
    ['name' => 'public_html/'],
    ['name' => 'public_html/index.html', 'data' => '<html>home</html>'],
    ['name' => 'public_html/assets/app-3f2a9c1b.js', 'data' => 'console.log(1)'],
    ['name' => 'root/.htaccess', 'data' => "RewriteEngine On\n"],
    ['name' => 'app/deploy/after-unpack.php', 'data' => "<?php return [];\n"],
    ['name' => 'app/.env.example', 'data' => "X=\n"],
    ['name' => 'manifest.json', 'data' => '{}'],
];
$refused = static function (array $entries, string $label, ?int $eocd = null) use ($zip, $work, $assert): void {
    try {
        ArchiveExtractor::extract($zip($entries, $eocd), $work . '/out-' . bin2hex(random_bytes(4)));
        $assert(false, $label);
    } catch (ReleaseException $exception) {
        $assert($exception->errorCode === 'unsafe_archive', $label . ' (' . $exception->getMessage() . ')');
    }
};

/* ───── entry names (zip-slip guard) ───── */

foreach (['../evil.txt', 'public_html/../../evil', '/etc/passwd', 'C:/windows/x', 'public_html\\..\\x', 'public_html//x', './public_html/x', "public_html/a\0b", "public_html/\x01x", 'public_html/./x', ''] as $bad) {
    $assert(ArchiveExtractor::unsafeName($bad) !== null, 'unsafe entry name refused: ' . json_encode($bad));
}
foreach (['public_html/index.html', 'public_html/product/[slug].html', 'public_html/+not-found.html', 'app/vendor/', 'root/api/index.php'] as $good) {
    $assert(ArchiveExtractor::unsafeName($good) === null, 'normal entry name accepted: ' . $good);
}
foreach (['app/.env', 'app/.env.production', 'public_html/.env.local', 'public_html/media/x.jpg', 'public_html/_current/x', 'public_html/_deploy/hook.php', 'public_html/.well-known/x', 'public_html/.htaccess', 'public_html/sub/.htaccess', 'root/api/.htaccess', 'root/media/x', 'root/_deploy/x', 'root/.user.ini', 'public_html/.deploy-release', 'other/file', 'app/.git/config'] as $forbidden) {
    $assert(ArchiveExtractor::forbiddenName($forbidden) !== null, 'server-only or unexpected path refused: ' . $forbidden);
}
foreach (['app/.env.example', 'root/.htaccess', 'root/api/index.php', 'app/public/.htaccess', 'manifest.json', 'public_html/robots.txt'] as $allowed) {
    $assert(ArchiveExtractor::forbiddenName($allowed) === null, 'allowed release path: ' . $allowed);
}

/* ───── hostile archives ───── */

$refused([...$valid, ['name' => 'public_html/../../escape.txt', 'data' => 'x']], 'a "../" entry is refused before anything is written');
$refused([...$valid, ['name' => '/tmp/deploy-kit-absolute.txt', 'data' => 'x']], 'an absolute entry is refused');
$refused([...$valid, ['name' => 'public_html/link', 'data' => '/etc/passwd', 'mode' => 0120777]], 'a symlink entry is refused');
$refused([...$valid, ['name' => 'public_html/fifo', 'mode' => 0010644]], 'a special-file entry is refused');
$refused([...$valid, ['name' => 'public_html/index.html', 'data' => 'twice']], 'duplicate names are refused');
$refused([...$valid, ['name' => 'app/.env', 'data' => 'DB_PASSWORD=x']], 'a .env in the archive is refused');
$refused([...$valid, ['name' => 'public_html/secret.txt', 'data' => 'x', 'flags' => 1]], 'an encrypted entry is refused');
$refused([...$valid, ['name' => 'public_html/b.txt', 'data' => 'x', 'method' => 12]], 'an unsupported compression method is refused');
$refused($valid, 'a zip64 end record is refused', 0xFFFF);
$refused(array_values(array_filter($valid, static fn (array $e): bool => $e['name'] !== 'root/.htaccess')), 'an archive without root/.htaccess is refused');
$refused(array_values(array_filter($valid, static fn (array $e): bool => !str_starts_with($e['name'], 'public_html/'))), 'an archive without public_html/ is refused');
$assert(!file_exists($work . '/escape.txt') && !file_exists(dirname($work) . '/escape.txt') && !file_exists('/tmp/deploy-kit-absolute.txt'), 'hostile archives wrote nothing outside the target');
file_put_contents($work . '/not-a-zip.zip', str_repeat('x', 100));
try {
    ArchiveExtractor::inspect($work . '/not-a-zip.zip');
    $assert(false, 'a non-zip file is refused');
} catch (ReleaseException $exception) {
    $assert($exception->errorCode === 'unsafe_archive', 'a non-zip file is refused');
}
foreach (array_filter(['zip' => class_exists(ZipArchive::class), 'phar' => class_exists(PharData::class)]) as $extractor => $_) {
    $target = $work . '/valid-' . $extractor;
    $stats = ArchiveExtractor::extract($zip($valid), $target, $extractor);
    $assert($stats['files'] === 6 && $stats['extractor'] === $extractor, "the {$extractor} extractor unpacks every file");
    $assert(file_get_contents($target . '/public_html/index.html') === '<html>home</html>' && decoct(fileperms($target . '/root/.htaccess') & 0777) === '644', "the {$extractor} extractor writes the content with mode 644");
}

/* ───── dotenv parsing ───── */

$envFile = $work . '/.env';
file_put_contents($envFile, "\xEF\xBB\xBFFIRST=bom\r\n# comment\r\nexport EXPORTED=yes\r\nDB_USERNAME=abc_app   # the app user\r\nDB_PASSWORD=pa#ss\r\nQUOTED=\"a # not a comment\" # but this is\r\nSINGLE='x y'\r\nEMPTY=\r\nSPACED = padded \r\nbad-key=1\r\nTOKEN=0123456789abcdef0123456789abcdef\t# tab comment\r\n");
$env = Env::load($envFile);
$assert(($env['FIRST'] ?? null) === 'bom', 'dotenv: a UTF-8 BOM before the first key is ignored');
$assert(($env['EXPORTED'] ?? null) === 'yes', 'dotenv: an export prefix is accepted');
$assert(($env['DB_USERNAME'] ?? null) === 'abc_app', 'dotenv: an inline " # comment" is dropped (the bug that once broke production DB auth)');
$assert(($env['DB_PASSWORD'] ?? null) === 'pa#ss', 'dotenv: a # without a space before it is kept');
$assert(($env['QUOTED'] ?? null) === 'a # not a comment', 'dotenv: a quoted value keeps its #, the comment after it goes');
$assert(($env['SINGLE'] ?? null) === 'x y' && ($env['EMPTY'] ?? null) === '' && ($env['SPACED'] ?? null) === 'padded', 'dotenv: single quotes, empty values and spaces around = work');
$assert(!isset($env['bad-key']) && ($env['TOKEN'] ?? null) === '0123456789abcdef0123456789abcdef', 'dotenv: invalid keys are skipped; CRLF and a tab before # are handled');

/* ───── .htaccess composition ───── */

$handler = "# php -- BEGIN cPanel-generated handler, do not edit\n<IfModule mime_module>\n  AddHandler application/x-httpd-ea-php83 .php .php8 .phtml\n</IfModule>\n# php -- END cPanel-generated handler, do not edit";
$ini = "# BEGIN cPanel-generated php ini directives, do not edit\n<IfModule php8_module>\n   php_flag display_errors Off\n</IfModule>\n# END cPanel-generated php ini directives, do not edit";
$live = "old rules\n{$handler}\n\n{$ini}\n";
$release = "# kit rules\nRewriteEngine On\n";
$composed = HtaccessComposer::compose($release, $live);
$assert(substr_count($composed, 'BEGIN cPanel-generated handler') === 1 && substr_count($composed, 'BEGIN cPanel-generated php ini') === 1 && str_contains($composed, 'ea-php83'), 'compose: both cPanel blocks are preserved once');
$assert(!str_contains($composed, 'old rules') && str_starts_with($composed, '# kit rules'), 'compose: the rest of the live file is replaced');
$assert(HtaccessComposer::compose($composed, $composed) === $composed && substr_count(HtaccessComposer::compose($release, $composed), 'BEGIN cPanel-generated') === 2, 'compose: composing again never duplicates a block');
$assert(HtaccessComposer::refreshCpanelBlocks($live, $composed) === $live, 'refresh: with unchanged blocks the old file comes back byte for byte');
$changed = str_replace('ea-php83', 'ea-php82', $composed);
$refreshed = HtaccessComposer::refreshCpanelBlocks($live, $changed);
$assert(str_contains($refreshed, 'ea-php82') && !str_contains($refreshed, 'ea-php83') && str_starts_with($refreshed, "old rules\n# php -- BEGIN"), 'refresh: a PHP version changed in cPanel since replaces the old block in place');
$assert(str_contains(HtaccessComposer::refreshCpanelBlocks("old rules\n", $composed), 'ea-php83'), 'refresh: blocks the old file lacked are appended');
$csp = static fn (string $hash): string => "Header set Content-Security-Policy \"default-src 'self'; script-src 'self' 'sha256-{$hash}=' https://x.example\"\n";
$merged = HtaccessComposer::compose($csp('NEW'), null, ["'sha256-OLD='", "'sha256-NEW='", 'junk']);
$assert(HtaccessComposer::scriptHashes($merged) === ["'sha256-NEW='", "'sha256-OLD='"], 'compose: inline-script hashes of kept releases are merged, without duplicates or junk');
$assert(HtaccessComposer::compose($release, null, ["'sha256-OLD='"]) === $release, 'compose: a file without a script-src hash list is left alone');

/* ───── client IP ───── */

$assert(ClientIp::resolve(['REMOTE_ADDR' => '203.0.113.9', 'HTTP_CF_CONNECTING_IP' => '198.51.100.1']) === '203.0.113.9', 'client ip: CF-Connecting-IP from a non-Cloudflare peer is ignored');
$assert(ClientIp::resolve(['REMOTE_ADDR' => '172.70.1.2', 'HTTP_CF_CONNECTING_IP' => '198.51.100.1']) === '198.51.100.1', 'client ip: CF-Connecting-IP from a Cloudflare edge is used');
$assert(ClientIp::resolve(['REMOTE_ADDR' => '2606:4700::1', 'HTTP_CF_CONNECTING_IP' => '240.0.0.1', 'HTTP_CF_CONNECTING_IPV6' => '2001:db8:1:2::5']) === '2001:db8:1:2::5', 'client ip: pseudo-IPv4 is undone through CF-Connecting-IPv6');
$assert(ClientIp::bucket('2001:db8:1:2:aaaa::1') === '2001:db8:1:2::/64' && ClientIp::bucket('203.0.113.9') === '203.0.113.9', 'client ip: IPv6 callers share one bucket per /64, IPv4 one per address');
$assert(ClientIp::resolve(['REMOTE_ADDR' => '::ffff:203.0.113.9']) === '203.0.113.9', 'client ip: IPv4-mapped IPv6 is unwrapped');

/* ───── release ids and names ───── */

$manager = new ReleaseManager($work . '/home', $work . '/home/public_html', $work . '/home/site_deploy', $work . '/home/site_app');
@mkdir($work . '/home/public_html', 0755, true);
foreach (['../x', 'legacy', 'a/b', '', str_repeat('a', 81)] as $bad) {
    try {
        $manager->release($bad, str_repeat('0', 64), static fn (): array => []);
        $assert(false, 'bad release id refused: ' . json_encode($bad));
    } catch (ReleaseException $exception) {
        $assert($exception->errorCode === 'invalid_request', 'bad release id refused: ' . json_encode($bad));
    }
}
foreach (['blog', 'client.co.za', '.htpasswd'] as $name) {
    $assert(ReleaseManager::plainName($name), 'DEPLOY_KEEP name accepted: ' . $name);
}
foreach (['..', '.', 'a/b', 'a b', ''] as $name) {
    $assert(!ReleaseManager::plainName($name), 'DEPLOY_KEEP name refused: ' . json_encode($name));
}

$remove = static function (string $path) use (&$remove): void {
    if (is_link($path) || is_file($path)) {
        @unlink($path);
        return;
    }
    foreach (is_dir($path) ? array_diff(scandir($path) ?: [], ['.', '..']) : [] as $name) {
        $remove($path . '/' . $name);
    }
    @rmdir($path);
};
$remove($work);
echo "unit: {$passed} passed, {$failed} failed\n";
exit($failed === 0 ? 0 : 1);
