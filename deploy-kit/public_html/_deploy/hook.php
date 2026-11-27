<?php

declare(strict_types=1);

// Deploy kit stub: ~/<DOCROOT>/_deploy/hook.php, the one public entry point of the deploy receiver.
// The workflow's bootstrap uploads it with the three names below filled in from the repository variables
// APP_DIR, DEPLOY_DIR and DOCROOT. It adds one folder (_deploy/) and changes nothing else, so uploading it
// onto a site that is already live is harmless. The receiver itself lives outside the web root.

// Folders in the cPanel home: APP_DIR has .env (DEPLOY_HOOK_TOKEN, DEPLOY_KEEP) and storage/; DEPLOY_DIR has
// the receiver, the releases and the state; DOCROOT is this site's document root.
const DEPLOY_KIT_APP_DIR = 'site_app';
const DEPLOY_KIT_DEPLOY_DIR = 'site_deploy';
const DEPLOY_KIT_DOCROOT = 'public_html';

// The cPanel home is one level above the document root, more for a nested one (public_html/shop.example.com).
$deployKitReceiver = dirname(__DIR__, 2 + substr_count(DEPLOY_KIT_DOCROOT, '/')) . '/' . DEPLOY_KIT_DEPLOY_DIR . '/receiver/hook.php';
if (!is_file($deployKitReceiver)) {
    http_response_code(404);
    exit;
}
require $deployKitReceiver;
