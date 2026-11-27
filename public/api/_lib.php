<?php
// Shared helpers for lead.php and leads.php. Not reachable over HTTP (.htaccess denies files starting with "_").
declare(strict_types=1);

if (PHP_SAPI !== 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) { http_response_code(404); exit; }

date_default_timezone_set('Africa/Johannesburg');

/** Settings from config.php (gitignored; copy config.example.php). Every key has a safe default. */
function tm_config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $defaults = [
        'notify_to' => ['admin@truemarc.co.za'],
        'mail_from' => 'website@truemarc.co.za',
        'mail_from_name' => 'Truemarc website',
        'smtp' => ['host' => '', 'port' => 587, 'secure' => 'tls', 'user' => '', 'pass' => '', 'timeout' => 10],
        'data_dir' => __DIR__ . '/data',
        'allowed_origins' => ['https://truemarc.co.za', 'https://www.truemarc.co.za'],
        'rate_limit' => ['per_10_min' => 8, 'per_day' => 40],
        'admin_password_hash' => '',
        'secret' => '',
    ];
    $file = __DIR__ . '/config.php';
    $user = is_file($file) ? (require $file) : [];
    if (!is_array($user)) $user = [];
    $cfg = array_replace($defaults, $user);
    $cfg['smtp'] = array_replace($defaults['smtp'], (array)($user['smtp'] ?? []));
    $cfg['rate_limit'] = array_replace($defaults['rate_limit'], (array)($user['rate_limit'] ?? []));
    $cfg['notify_to'] = array_values(array_filter((array)$cfg['notify_to']));
    return $cfg;
}

/** Private data directory (leads, rate-limit counters, error log), created locked-down on first use. */
function tm_data_dir(): string
{
    $dir = rtrim((string)tm_config()['data_dir'], '/');
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    if (is_dir($dir) && !is_file("$dir/.htaccess")) {
        @file_put_contents("$dir/.htaccess", "Require all denied\n<IfModule !mod_authz_core.c>\n  Deny from all\n</IfModule>\n");
        @file_put_contents("$dir/index.html", '');
    }
    return $dir;
}

/** Log for the site owner/developer. Never shown to visitors. */
function tm_log(string $msg): void
{
    $line = '[' . date('c') . '] ' . preg_replace('/\s+/', ' ', $msg) . "\n";
    if (@file_put_contents(tm_data_dir() . '/error.log', $line, FILE_APPEND | LOCK_EX) === false) error_log('truemarc: ' . $msg);
}

function tm_secret(): string
{
    $s = (string)tm_config()['secret'];
    return $s !== '' ? $s : hash('sha256', __DIR__ . php_uname('n'));
}

function tm_client_ip(): string
{
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/** Salted hash: lets us rate-limit and spot repeat abuse without storing raw IP addresses (POPIA). */
function tm_ip_hash(): string
{
    return substr(hash_hmac('sha256', tm_client_ip(), tm_secret()), 0, 16);
}

/**
 * Sliding-window limiter on small files: true if the caller is still under every limit (and records the hit).
 * $limits = [seconds => max hits]. Fails open: a broken limiter must never block a real lead.
 */
function tm_rate_ok(string $bucket, array $limits): bool
{
    try {
        $dir = tm_data_dir() . '/ratelimit';
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        $file = $dir . '/' . $bucket . '-' . tm_ip_hash() . '.json';
        $fh = @fopen($file, 'c+');
        if (!$fh) return true;
        flock($fh, LOCK_EX);
        $now = time();
        $hits = json_decode((string)stream_get_contents($fh), true);
        $hits = is_array($hits) ? $hits : [];
        $window = max(array_keys($limits));
        $hits = array_values(array_filter($hits, fn($t) => is_int($t) && $t > $now - $window));
        foreach ($limits as $secs => $max) {
            if (count(array_filter($hits, fn($t) => $t > $now - $secs)) >= $max) {
                flock($fh, LOCK_UN); fclose($fh);
                return false;
            }
        }
        $hits[] = $now;
        ftruncate($fh, 0); rewind($fh);
        fwrite($fh, json_encode($hits));
        flock($fh, LOCK_UN); fclose($fh);
        if (random_int(1, 50) === 1) tm_rate_gc($dir, $window);
        return true;
    } catch (Throwable $e) {
        tm_log('rate limiter: ' . $e->getMessage());
        return true;
    }
}

function tm_rate_gc(string $dir, int $window): void
{
    foreach (glob($dir . '/*.json') ?: [] as $f) {
        if (@filemtime($f) < time() - $window) @unlink($f);
    }
}

// ---------------------------------------------------------------------------
// Lead fields
// ---------------------------------------------------------------------------

/** Plain single-line text: no control characters, collapsed whitespace, length-capped. */
function tm_clean(mixed $v, int $max): string
{
    if (!is_scalar($v)) return '';
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$v) ?? '';
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $max);
}

/** Multi-line text (the message): keeps newlines, drops other control characters. */
function tm_clean_text(mixed $v, int $max): string
{
    if (!is_scalar($v)) return '';
    $s = str_replace(["\r\n", "\r"], "\n", (string)$v);
    $s = preg_replace('/[\x00-\x09\x0B-\x1F\x7F]+/u', ' ', $s) ?? '';
    $s = preg_replace("/\n{3,}/", "\n\n", $s) ?? '';
    return mb_substr(trim($s), 0, $max);
}

/** Same rules as normalizeZaPhone() in src/lib/leads.ts: returns +27XXXXXXXXX or null. */
function tm_za_phone(string $raw): ?string
{
    $n = preg_replace('/[^\d+]/', '', $raw) ?? '';
    if (str_starts_with($n, '+27')) $n = substr($n, 3);
    elseif (str_starts_with($n, '0027')) $n = substr($n, 4);
    elseif (str_starts_with($n, '27') && strlen($n) === 11) $n = substr($n, 2);
    elseif (str_starts_with($n, '0')) $n = substr($n, 1);
    return preg_match('/^[1-8]\d{8}$/', $n) ? '+27' . $n : null;
}

function tm_local_phone(string $e164): string
{
    $l = '0' . substr($e164, 3);
    return substr($l, 0, 3) . ' ' . substr($l, 3, 3) . ' ' . substr($l, 6);
}

/** Labels for the assessment answers (mirror of src/lib/site.ts; unknown ids are shown as-is). */
function tm_label(string $kind, string $id): string
{
    static $labels = [
        'situation' => [
            'declined' => 'Declined for credit', 'judgment' => 'Default or judgment', 'debt-review' => 'Stuck in debt review',
            'over-indebted' => 'Struggling with debt', 'fraud' => 'Fraud on my name', 'admin-order' => 'Admin order',
            'unsure' => 'Not sure, check my record',
        ],
        'goal' => [
            'car' => 'Finance a car', 'home' => 'Get a home loan', 'credit' => 'Get credit or a contract',
            'lower' => 'Lower my repayments', 'clear' => 'Just clear my name',
        ],
        'debt' => [
            'lt20' => 'Under R20,000', '20-100' => 'R20,000 – R100,000', '100-300' => 'R100,000 – R300,000',
            'gt300' => 'Over R300,000', 'unsure' => 'Not sure',
        ],
    ];
    return $id === '' ? '' : ($labels[$kind][$id] ?? $id);
}

// ---------------------------------------------------------------------------
// Storage: SQLite when available, append-only JSONL otherwise
// ---------------------------------------------------------------------------

const TM_COLUMNS = ['id', 'created_at', 'first_name', 'phone', 'email', 'message', 'situation', 'goal', 'debt', 'source', 'page', 'attribution', 'ip_hash', 'user_agent'];

function tm_db(): ?PDO
{
    static $pdo = false;
    if ($pdo !== false) return $pdo;
    $pdo = null;
    if (!extension_loaded('pdo_sqlite')) return null;
    try {
        $db = new PDO('sqlite:' . tm_data_dir() . '/leads.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
        $db->exec('PRAGMA busy_timeout = 5000');
        $db->exec('PRAGMA journal_mode = WAL');
        $db->exec('CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY, created_at TEXT NOT NULL, first_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
            message TEXT, situation TEXT, goal TEXT, debt TEXT, source TEXT, page TEXT, attribution TEXT,
            ip_hash TEXT, user_agent TEXT)');
        $db->exec('CREATE INDEX IF NOT EXISTS leads_created ON leads (created_at)');
        $pdo = $db;
    } catch (Throwable $e) {
        tm_log('sqlite unavailable: ' . $e->getMessage());
    }
    return $pdo;
}

/** Saves the lead; returns where it went ('sqlite' | 'jsonl') or null if both failed. */
function tm_store(array $lead): ?string
{
    $db = tm_db();
    if ($db) {
        try {
            $cols = implode(',', TM_COLUMNS);
            $marks = implode(',', array_map(fn($c) => ':' . $c, TM_COLUMNS));
            $st = $db->prepare("INSERT INTO leads ($cols) VALUES ($marks)");
            foreach (TM_COLUMNS as $c) $st->bindValue(':' . $c, $lead[$c] ?? null);
            $st->execute();
            return 'sqlite';
        } catch (Throwable $e) {
            tm_log('sqlite insert failed, using jsonl: ' . $e->getMessage());
        }
    }
    $line = json_encode($lead, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    return @file_put_contents(tm_data_dir() . '/leads.jsonl', $line, FILE_APPEND | LOCK_EX) !== false ? 'jsonl' : null;
}

/** Most recent leads from both stores (newest first). $q filters on name/phone/email. */
function tm_recent(int $limit = 300, string $q = ''): array
{
    $rows = [];
    $db = tm_db();
    if ($db) {
        try {
            if ($q !== '') {
                $st = $db->prepare("SELECT * FROM leads WHERE first_name LIKE :q OR phone LIKE :q OR email LIKE :q OR message LIKE :q ORDER BY created_at DESC LIMIT :n");
                $st->bindValue(':q', '%' . $q . '%');
            } else {
                $st = $db->prepare('SELECT * FROM leads ORDER BY created_at DESC LIMIT :n');
            }
            $st->bindValue(':n', $limit, PDO::PARAM_INT);
            $st->execute();
            $rows = $st->fetchAll();
        } catch (Throwable $e) {
            tm_log('sqlite read failed: ' . $e->getMessage());
        }
    }
    $jsonl = tm_data_dir() . '/leads.jsonl';
    if (is_file($jsonl)) {
        foreach (file($jsonl, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $r = json_decode($line, true);
            if (!is_array($r)) continue;
            if ($q !== '' && stripos(implode(' ', [$r['first_name'] ?? '', $r['phone'] ?? '', $r['email'] ?? '', $r['message'] ?? '']), $q) === false) continue;
            $rows[] = $r;
        }
    }
    usort($rows, fn($a, $b) => strcmp((string)($b['created_at'] ?? ''), (string)($a['created_at'] ?? '')));
    return array_slice($rows, 0, $limit);
}

// ---------------------------------------------------------------------------
// Mail: SMTP (preferred, set in config.php) or PHP mail()
// ---------------------------------------------------------------------------

function tm_header_safe(string $s): string
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', $s));
}

function tm_encode_header(string $s): string
{
    $s = tm_header_safe($s);
    return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

/** Sends a plain-text email. Returns true on success; logs and returns false otherwise. */
function tm_mail(array $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $cfg = tm_config();
    $to = array_values(array_filter($to, fn($a) => filter_var($a, FILTER_VALIDATE_EMAIL)));
    if (!$to) { tm_log('mail: no valid notify_to address'); return false; }
    $from = (string)$cfg['mail_from'];
    $fromName = (string)$cfg['mail_from_name'];
    $host = parse_url('https://' . ($_SERVER['HTTP_HOST'] ?? 'truemarc.co.za'), PHP_URL_HOST) ?: 'truemarc.co.za';
    $headers = [
        'Date' => date('r'),
        'From' => tm_encode_header($fromName) . ' <' . tm_header_safe($from) . '>',
        'To' => implode(', ', $to),
        'Subject' => tm_encode_header($subject),
        'Message-ID' => '<' . bin2hex(random_bytes(12)) . '@' . $host . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding' => 'base64',
        'X-Mailer' => 'truemarc-lead',
    ];
    if ($replyTo && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers['Reply-To'] = tm_header_safe($replyTo);
    $encoded = rtrim(chunk_split(base64_encode($body), 76, "\r\n"));
    try {
        if (!empty($cfg['smtp']['host'])) return tm_smtp($cfg['smtp'], $from, $to, $headers, $encoded);
        $h = $headers;
        unset($h['To'], $h['Subject']);
        $lines = [];
        foreach ($h as $k => $v) $lines[] = "$k: $v";
        $envelope = filter_var($from, FILTER_VALIDATE_EMAIL) ? '-f' . $from : '';
        $ok = @mail(implode(', ', $to), $headers['Subject'], $encoded, implode("\r\n", $lines), $envelope);
        if (!$ok) tm_log('mail(): returned false');
        return $ok;
    } catch (Throwable $e) {
        tm_log('mail: ' . $e->getMessage());
        return false;
    }
}

/** Minimal SMTP client: implicit TLS (465, secure=ssl) or STARTTLS (587, secure=tls), AUTH LOGIN. */
function tm_smtp(array $s, string $from, array $to, array $headers, string $body): bool
{
    $timeout = (int)($s['timeout'] ?? 10);
    $secure = strtolower((string)($s['secure'] ?? 'tls'));
    $port = (int)($s['port'] ?? ($secure === 'ssl' ? 465 : 587));
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $s['host']]]);
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $s['host'] . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) throw new RuntimeException("smtp connect $remote: $errstr ($errno)");
    stream_set_timeout($fp, $timeout);
    $read = function () use ($fp): array {
        $data = '';
        while (($line = fgets($fp, 1024)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        return [(int)substr($data, 0, 3), trim($data)];
    };
    $cmd = function (?string $line, array $expect) use ($fp, $read): string {
        if ($line !== null) fwrite($fp, $line . "\r\n");
        [$code, $text] = $read();
        if (!in_array($code, $expect, true)) {
            $shown = $line !== null && str_starts_with($line, 'AUTH') ? 'AUTH' : ($line ?? 'greeting');
            throw new RuntimeException("smtp: '$shown' → $text");
        }
        return $text;
    };
    try {
        $ehlo = 'EHLO ' . (gethostname() ?: 'localhost');
        $cmd(null, [220]);
        $caps = $cmd($ehlo, [250]);
        if ($secure === 'tls') {
            if (stripos($caps, 'STARTTLS') === false) throw new RuntimeException('smtp: server does not offer STARTTLS');
            $cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) throw new RuntimeException('smtp: TLS handshake failed');
            $cmd($ehlo, [250]);
        }
        if (!empty($s['user'])) {
            $cmd('AUTH LOGIN', [334]);
            $cmd(base64_encode((string)$s['user']), [334]);
            $cmd(base64_encode((string)$s['pass']), [235]);
        }
        $cmd('MAIL FROM:<' . tm_header_safe($from) . '>', [250]);
        foreach ($to as $rcpt) $cmd('RCPT TO:<' . tm_header_safe($rcpt) . '>', [250, 251]);
        $cmd('DATA', [354]);
        $msg = '';
        foreach ($headers as $k => $v) $msg .= "$k: $v\r\n";
        $msg .= "\r\n" . preg_replace('/^\./m', '..', $body) . "\r\n.";
        $cmd($msg, [250]);
        $cmd('QUIT', [221]);
        return true;
    } finally {
        fclose($fp);
    }
}

function tm_json(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}
