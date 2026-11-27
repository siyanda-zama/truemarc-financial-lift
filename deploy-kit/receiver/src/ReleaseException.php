<?php

declare(strict_types=1);

namespace DeployKit;

use RuntimeException;

/**
 * A release step that failed with a reportable reason. The HTTP answer carries only the code (and the
 * request id); the message and details go to deploy-hook.log, because they can name files on the server.
 */
final class ReleaseException extends RuntimeException
{
    /** @param array<string,mixed> $details names and counts only, never secrets */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 500,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }
}
