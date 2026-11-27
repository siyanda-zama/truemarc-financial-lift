<?php

declare(strict_types=1);

// Deploy kit receiver: ~/<DEPLOY_DIR>/receiver/hook.php, outside the web root. The only way in is the
// stub ~/<DOCROOT>/_deploy/hook.php, which defines the folder names and requires this file.
// This file stays in PHP 7 syntax, so an old PHP version gets a clear answer instead of a parse error.

if (PHP_VERSION_ID < 80100) {
    // Only callers that send a token learn why; everyone else sees a missing page.
    $deployKitToken = isset($_SERVER['HTTP_X_DEPLOY_TOKEN']) ? trim((string) $_SERVER['HTTP_X_DEPLOY_TOKEN']) : '';
    http_response_code($deployKitToken === '' ? 404 : 500);
    header('Cache-Control: no-store');
    if ($deployKitToken !== '') {
        header('Content-Type: application/json; charset=utf-8');
        echo '{"ok":false,"error":{"code":"php_too_old"},"capabilities":{"php_version":"' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . '"}}';
    }
    exit;
}

// Every class the receiver loads (and hashes for receiver_digest, which the workflow compares).
const DEPLOY_KIT_SOURCES = ['ReleaseException', 'Env', 'ClientIp', 'RateLimiter', 'ArchiveExtractor', 'HtaccessComposer', 'ReleaseManager', 'Hook'];

foreach (DEPLOY_KIT_SOURCES as $deployKitSource) {
    require_once __DIR__ . '/src/' . $deployKitSource . '.php';
}

\DeployKit\Hook::fromStub(__DIR__, DEPLOY_KIT_SOURCES)->handle();
