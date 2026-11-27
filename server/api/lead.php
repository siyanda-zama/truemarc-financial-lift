<?php
/**
 * Truemarc lead endpoint. POST application/json → { ok: true, id } | { ok: false, error }.
 * Same contract as the dev stub in vite.config.ts and submitLead() in src/lib/leads.ts.
 *
 * Order of work, so a real lead is never lost:
 *   validate → store (SQLite, else JSONL) → answer the visitor → email the business.
 * If storage fails the email is sent before answering, and only if both fail does the visitor get an error
 * (the site then offers WhatsApp/call instead).
 */
declare(strict_types=1);

require __DIR__ . '/_lib.php';

set_exception_handler(function (Throwable $e): void {
    tm_log('lead.php uncaught: ' . $e->getMessage() . ' @' . basename($e->getFile()) . ':' . $e->getLine());
    if (!headers_sent()) tm_json(500, ['ok' => false, 'error' => 'server']);
});
ini_set('display_errors', '0');

$cfg = tm_config();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    tm_json(405, ['ok' => false, 'error' => 'method_not_allowed']);
}

// Browsers always send Origin on a cross-site POST: only our own site may submit.
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
if ($origin !== '') {
    $self = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    if ($origin !== $self && !in_array($origin, (array)$cfg['allowed_origins'], true)) {
        tm_json(403, ['ok' => false, 'error' => 'forbidden']);
    }
}

if (stripos((string)($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') === false) {
    tm_json(415, ['ok' => false, 'error' => 'unsupported_media_type']);
}

$raw = file_get_contents('php://input', false, null, 0, 16385);
if ($raw === false || strlen($raw) > 16384) tm_json(413, ['ok' => false, 'error' => 'too_large']);

try {
    $in = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
} catch (Throwable) {
    tm_json(400, ['ok' => false, 'error' => 'bad_json']);
}
if (!is_array($in)) tm_json(400, ['ok' => false, 'error' => 'bad_json']);

// Honeypot: bots fill every field. Pretend it worked so they don't adapt.
if (tm_clean($in['website'] ?? '', 200) !== '') tm_json(200, ['ok' => true]);

if (!tm_rate_ok('lead', [600 => (int)$cfg['rate_limit']['per_10_min'], 86400 => (int)$cfg['rate_limit']['per_day']])) {
    header('Retry-After: 600');
    tm_json(429, ['ok' => false, 'error' => 'rate_limited']);
}

// ---- Validate ---------------------------------------------------------------
$firstName = tm_clean($in['firstName'] ?? '', 60);
if (mb_strlen($firstName) < 2 || !preg_match('/\p{L}/u', $firstName)) tm_json(400, ['ok' => false, 'error' => 'invalid_name']);

$phone = tm_za_phone(tm_clean($in['phone'] ?? '', 30));
if ($phone === null) tm_json(400, ['ok' => false, 'error' => 'invalid_phone']);

if (($in['consent'] ?? null) !== true) tm_json(400, ['ok' => false, 'error' => 'consent_required']);

$message = tm_clean_text($in['message'] ?? '', 2000);
$email = tm_clean($in['email'] ?? '', 254);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    // Keep the lead; a typo in an optional field is not a reason to lose it.
    $message = trim($message . "\n\n(Email as typed: $email)");
    $email = '';
}

$attribution = [];
if (is_array($in['attribution'] ?? null)) {
    foreach (array_slice($in['attribution'], 0, 12, true) as $k => $v) {
        $key = preg_replace('/[^a-z0-9_]/i', '', (string)$k);
        if ($key !== '' && is_scalar($v)) $attribution[$key] = tm_clean($v, 300);
    }
}

$id = 'TM-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
$lead = [
    'id' => $id,
    'created_at' => date('c'),
    'first_name' => $firstName,
    'phone' => $phone,
    'email' => $email !== '' ? $email : null,
    'message' => $message !== '' ? $message : null,
    'situation' => tm_clean($in['situation'] ?? '', 40) ?: null,
    'goal' => tm_clean($in['goal'] ?? '', 40) ?: null,
    'debt' => tm_clean($in['debt'] ?? '', 40) ?: null,
    'source' => tm_clean($in['source'] ?? '', 80) ?: null,
    'page' => tm_clean($in['page'] ?? '', 200) ?: null,
    'attribution' => $attribution ? json_encode($attribution, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
    'ip_hash' => tm_ip_hash(),
    'user_agent' => tm_clean($_SERVER['HTTP_USER_AGENT'] ?? '', 300) ?: null,
];

// ---- Notification email -----------------------------------------------------
function tm_lead_email(array $l, array $attr): array
{
    $local = tm_local_phone($l['phone']);
    $wa = 'https://wa.me/' . ltrim($l['phone'], '+');
    $sit = tm_label('situation', (string)$l['situation']);
    $subject = "New lead: {$l['first_name']}, $local" . ($sit ? " ($sit)" : '');
    $rows = [
        'Name' => $l['first_name'],
        'Phone' => "$local  (tel:{$l['phone']})",
        'WhatsApp' => $wa,
        'Email' => $l['email'] ?? '',
        'Situation' => $sit,
        'Goal' => tm_label('goal', (string)$l['goal']),
        'Debt' => tm_label('debt', (string)$l['debt']),
        'Form' => $l['source'] ?? '',
        'Page' => $l['page'] ?? '',
    ];
    $body = "A new free-assessment request came in on the website. Please call back within 24 hours.\n\n";
    foreach ($rows as $k => $v) if ($v !== '') $body .= str_pad($k . ':', 11) . $v . "\n";
    if (!empty($l['message'])) $body .= "\nMessage:\n" . $l['message'] . "\n";
    if ($attr) {
        $body .= "\nHow they found us:\n";
        foreach ($attr as $k => $v) if ($v !== '') $body .= "  $k: $v\n";
    }
    $body .= "\nReceived: " . date('D j M Y, H:i') . "\nReference: {$l['id']}\n";
    return [$subject, $body];
}

[$subject, $body] = tm_lead_email($lead, $attribution);
$notify = fn(): bool => tm_mail((array)$cfg['notify_to'], $subject, $body, $lead['email']);

$stored = tm_store($lead);
if ($stored === null) {
    tm_log("storage failed for $id; relying on email");
    if (!$notify()) {
        tm_log("LEAD LOST? storage and email both failed for $id (phone ends " . substr($phone, -3) . ')');
        tm_json(500, ['ok' => false, 'error' => 'server']);
    }
    tm_json(200, ['ok' => true, 'id' => $id]);
}

// Stored safely: answer the visitor now, then send the email without making them wait (PHP-FPM / LiteSpeed).
ignore_user_abort(true);
http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex');
echo json_encode(['ok' => true, 'id' => $id]);
if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
elseif (function_exists('litespeed_finish_request')) litespeed_finish_request();
else flush();

if (!$notify()) tm_log("email failed for $id (lead is stored in $stored)");
