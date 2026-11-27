<?php
/**
 * Truemarc leads inbox: https://truemarc.co.za/api/leads.php
 * Password: LEADS_ADMIN_PASSWORD_HASH in ~/<APP_DIR>/.env on the server. Create the hash with:
 *   php -r "echo password_hash('your-long-passphrase', PASSWORD_DEFAULT), PHP_EOL;"
 * ?export=csv downloads every lead (or the current search) for Excel/Google Sheets.
 */
declare(strict_types=1);

require __DIR__ . '/_lib.php';
ini_set('display_errors', '0');

$cfg = tm_config();
$https = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

if (empty($cfg['admin_password_hash'])) {
    http_response_code(503);
    exit('Not configured: set LEADS_ADMIN_PASSWORD_HASH in the server .env (see .env.example).');
}

session_name('tm_admin');
session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME'] ?? '/api/leads.php'), 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$h = fn($s): string => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
$csrfOk = fn(): bool => hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''));
$authed = !empty($_SESSION['ok']) && ($_SESSION['at'] ?? 0) > time() - 8 * 3600;
$error = '';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    $action = (string)($_POST['action'] ?? '');
    if (!$csrfOk()) {
        $error = 'Your session expired. Please try again.';
    } elseif ($action === 'logout') {
        $_SESSION = [];
        session_regenerate_id(true);
        header('Location: leads.php', true, 303);
        exit;
    } elseif ($action === 'login') {
        if (!tm_rate_ok('login', [900 => 6, 86400 => 30])) {
            $error = 'Too many attempts. Try again in 15 minutes.';
        } elseif (password_verify((string)($_POST['password'] ?? ''), (string)$cfg['admin_password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['ok'] = true;
            $_SESSION['at'] = time();
            $_SESSION['csrf'] = bin2hex(random_bytes(16));
            header('Location: leads.php', true, 303);
            exit;
        } else {
            usleep(400000);
            $error = 'That password is not right.';
        }
    }
}

$page = function (string $title, string $body) use ($h): void {
    echo '<!doctype html><html lang="en-ZA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex, nofollow"><title>' . $h($title) . '</title><style>'
        . ':root{--night:#0d1036;--red:#e0262d;--ink:#14173a;--ink2:#4b4f73;--line:#e2e4ef;--mist:#f4f5fa;--green:#12a150}'
        . '*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--mist)}'
        . 'header{background:var(--night);color:#fff;padding:14px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}'
        . 'header b{font-size:1.05rem}header form{margin:0}main{max-width:1100px;margin:0 auto;padding:16px}'
        . 'a{color:inherit}.btn{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 16px;border-radius:999px;border:0;background:var(--red);color:#fff;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}'
        . '.btn--ghost{background:transparent;border:1px solid rgba(255,255,255,.4)}.btn--line{background:#fff;color:var(--ink);border:1px solid var(--line)}.btn--wa{background:#25d366;color:#06331f}'
        . '.bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}.bar input{flex:1 1 220px;min-height:42px;padding:0 14px;border:1px solid var(--line);border-radius:12px;font:inherit}'
        . '.meta{color:var(--ink2);font-size:.9rem;margin:0 0 12px}.lead{background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin-bottom:10px}'
        . '.lead__top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}.lead h2{margin:0;font-size:1.1rem}.lead time{color:var(--ink2);font-size:.88rem}'
        . '.lead dl{display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:10px 0;font-size:.94rem}.lead dt{color:var(--ink2)}.lead dd{margin:0;overflow-wrap:anywhere}'
        . '.lead p{margin:8px 0;white-space:pre-wrap;background:var(--mist);border-radius:10px;padding:10px 12px;font-size:.94rem}.acts{display:flex;gap:8px;flex-wrap:wrap}'
        . '.login{max-width:380px;margin:12vh auto;background:#fff;border-radius:20px;padding:28px;border:1px solid var(--line)}.login h1{margin:0 0 16px;font-size:1.4rem}'
        . '.login input{width:100%;min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:12px;font:inherit;margin:6px 0 14px}.err{color:var(--red);font-weight:600}'
        . '.tag{display:inline-block;padding:2px 10px;border-radius:999px;background:#fdeced;color:#a3151b;font-size:.82rem;font-weight:700}'
        . '</style></head><body>' . $body . '</body></html>';
};

if (!$authed) {
    $page('Truemarc leads: sign in', '<form class="login" method="post"><h1>Truemarc leads</h1>'
        . ($error ? '<p class="err" role="alert">' . $h($error) . '</p>' : '')
        . '<label for="pw">Password</label><input id="pw" type="password" name="password" autocomplete="current-password" required autofocus>'
        . '<input type="hidden" name="action" value="login"><input type="hidden" name="csrf" value="' . $h($_SESSION['csrf']) . '">'
        . '<button class="btn" type="submit">Sign in</button></form>');
    exit;
}
$_SESSION['at'] = time();

$q = tm_clean($_GET['q'] ?? '', 80);

// ---- CSV export ---------------------------------------------------------------
if (($_GET['export'] ?? '') === 'csv') {
    $rows = tm_recent(100000, $q);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="truemarc-leads-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // Excel: read as UTF-8
    // Spreadsheet formula injection guard: cells starting with = + - @ are prefixed with '.
    $cell = fn($v): string => preg_match('/^[=+\-@\t\r]/', (string)$v) ? "'" . $v : (string)$v;
    fputcsv($out, ['Reference', 'Received', 'Name', 'Phone', 'Email', 'Situation', 'Goal', 'Debt', 'Message', 'Form', 'Page', 'Attribution'], ',', '"', '');
    foreach ($rows as $r) {
        fputcsv($out, array_map($cell, [
            $r['id'] ?? '', isset($r['created_at']) ? date('Y-m-d H:i', strtotime((string)$r['created_at'])) : '', $r['first_name'] ?? '',
            isset($r['phone']) ? tm_local_phone((string)$r['phone']) : '', $r['email'] ?? '',
            tm_label('situation', (string)($r['situation'] ?? '')), tm_label('goal', (string)($r['goal'] ?? '')), tm_label('debt', (string)($r['debt'] ?? '')),
            $r['message'] ?? '', $r['source'] ?? '', $r['page'] ?? '', $r['attribution'] ?? '',
        ]), ',', '"', '');
    }
    exit;
}

// ---- List -----------------------------------------------------------------------
$rows = tm_recent(300, $q);
$today = count(array_filter($rows, fn($r) => str_starts_with((string)($r['created_at'] ?? ''), date('Y-m-d'))));
$html = '<header><b>Truemarc leads</b><form method="post"><input type="hidden" name="action" value="logout"><input type="hidden" name="csrf" value="' . $h($_SESSION['csrf']) . '"><button class="btn btn--ghost" type="submit">Sign out</button></form></header><main>';
$html .= '<form class="bar" method="get"><input type="search" name="q" value="' . $h($q) . '" placeholder="Search name, phone, email" aria-label="Search leads">'
    . '<button class="btn btn--line" type="submit">Search</button><a class="btn" href="?export=csv' . ($q !== '' ? '&amp;q=' . $h(rawurlencode($q)) : '') . '">Download CSV</a></form>';
$html .= '<p class="meta">' . count($rows) . ($q !== '' ? ' matching' : ' most recent') . ' lead' . (count($rows) === 1 ? '' : 's') . ($q === '' ? " · $today today" : '') . ' · times are SAST</p>';
if (!$rows) $html .= '<div class="lead">No leads yet.</div>';
foreach ($rows as $r) {
    $phone = (string)($r['phone'] ?? '');
    $attr = json_decode((string)($r['attribution'] ?? ''), true);
    $from = is_array($attr) ? implode(' · ', array_filter([$attr['utm_source'] ?? '', $attr['utm_campaign'] ?? '', isset($attr['gclid']) ? 'Google Ads' : '', isset($attr['fbclid']) ? 'Facebook' : '', $attr['referrer'] ?? ''])) : '';
    $details = array_filter([
        'Situation' => tm_label('situation', (string)($r['situation'] ?? '')),
        'Goal' => tm_label('goal', (string)($r['goal'] ?? '')),
        'Debt' => tm_label('debt', (string)($r['debt'] ?? '')),
        'Email' => (string)($r['email'] ?? ''),
        'Form' => (string)($r['source'] ?? ''),
        'Came from' => $from,
    ]);
    $html .= '<article class="lead"><div class="lead__top"><h2>' . $h($r['first_name'] ?? '') . ' · ' . $h($phone ? tm_local_phone($phone) : '') . '</h2>'
        . '<time datetime="' . $h($r['created_at'] ?? '') . '">' . $h(isset($r['created_at']) ? date('D j M, H:i', strtotime((string)$r['created_at'])) : '') . '</time></div><dl>';
    foreach ($details as $k => $v) $html .= '<dt>' . $h($k) . '</dt><dd>' . $h($v) . '</dd>';
    $html .= '</dl>' . (!empty($r['message']) ? '<p>' . $h($r['message']) . '</p>' : '');
    if ($phone) {
        $html .= '<div class="acts"><a class="btn" href="tel:' . $h($phone) . '">Call</a><a class="btn btn--wa" href="https://wa.me/' . $h(ltrim($phone, '+')) . '" target="_blank" rel="noopener">WhatsApp</a>'
            . (!empty($r['email']) ? '<a class="btn btn--line" href="mailto:' . $h($r['email']) . '">Email</a>' : '') . '<span class="tag">' . $h($r['id'] ?? '') . '</span></div>';
    }
    $html .= '</article>';
}
$html .= '</main>';
$page('Truemarc leads', $html);
