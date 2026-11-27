<?php
// Copy to config.php ON THE SERVER (it is gitignored and denied over HTTP) and fill in.
// Every key is optional; missing keys fall back to the defaults shown here.
return [
    // Who gets the "new lead" email. Several addresses are fine.
    'notify_to' => ['admin@truemarc.co.za'],

    // Sender. Must be a real mailbox on truemarc.co.za (create it in cPanel → Email Accounts) and the domain
    // needs SPF, DKIM and DMARC records, or the notifications land in spam.
    'mail_from' => 'website@truemarc.co.za',
    'mail_from_name' => 'Truemarc website',

    // SMTP is strongly recommended over PHP mail(). Leave host empty to use mail().
    // cPanel: host mail.truemarc.co.za, port 465 + 'ssl' (or 587 + 'tls'), user = the full mailbox address.
    'smtp' => [
        'host' => '',
        'port' => 465,
        'secure' => 'ssl', // 'ssl' (implicit TLS, 465) or 'tls' (STARTTLS, 587)
        'user' => 'website@truemarc.co.za',
        'pass' => '',
        'timeout' => 10,
    ],

    // Leads, rate-limit counters and the error log. Best OUTSIDE the web root so a deploy can never delete or
    // expose it, e.g. '/home/CPANELUSER/truemarc-data'. The default (api/data) is protected by .htaccess.
    'data_dir' => __DIR__ . '/data',

    // Sites allowed to post leads (the request's Origin header). The site's own host is always allowed.
    'allowed_origins' => ['https://truemarc.co.za', 'https://www.truemarc.co.za'],

    // Per visitor IP. Generous on purpose: many SA mobile users share one carrier IP.
    'rate_limit' => ['per_10_min' => 8, 'per_day' => 40],

    // Password for /api/leads.php. Generate the hash with:
    //   php -r "echo password_hash('a-long-passphrase', PASSWORD_DEFAULT), PHP_EOL;"
    'admin_password_hash' => '',

    // Random string used to hash visitor IPs (no raw IPs are stored). Generate with:
    //   php -r "echo bin2hex(random_bytes(24)), PHP_EOL;"
    'secret' => '',
];
