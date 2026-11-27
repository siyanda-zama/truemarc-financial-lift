<?php

declare(strict_types=1);

namespace DeployKit;

/** A sliding-window counter per key, one small JSON file per key (flock'd), under the persistent storage. */
final class RateLimiter
{
    public function __construct(private readonly string $directory)
    {
    }

    public function tooManyAttempts(string $key, int $limit, int $windowSeconds): bool
    {
        if (!is_dir($this->directory) && !@mkdir($this->directory, 0770, true) && !is_dir($this->directory)) {
            return false;
        }
        $path = $this->directory . '/' . hash('sha256', $key) . '.json';
        $now = time();
        $handle = @fopen($path, 'c+');
        if ($handle === false) {
            return false;
        }
        flock($handle, LOCK_EX);
        $contents = stream_get_contents($handle);
        $attempts = $contents ? json_decode($contents, true) : [];
        $attempts = array_values(array_filter(is_array($attempts) ? $attempts : [], static fn ($timestamp): bool => is_int($timestamp) && $timestamp > $now - $windowSeconds));
        $blocked = count($attempts) >= $limit;
        if (!$blocked) {
            $attempts[] = $now;
        }
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, (string) json_encode($attempts));
        fflush($handle);
        flock($handle, LOCK_UN);
        fclose($handle);
        return $blocked;
    }
}
