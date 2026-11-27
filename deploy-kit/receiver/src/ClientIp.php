<?php

declare(strict_types=1);

namespace DeployKit;

/**
 * The caller's IP for rate limiting and the log. Behind Cloudflare every request arrives from an edge
 * address, so CF-Connecting-IP is used, but only when the TCP peer really is a Cloudflare edge: anyone
 * else could send that header to dodge the limit or to fill another address's bucket.
 */
final class ClientIp
{
    /** https://www.cloudflare.com/ips-v4 and /ips-v6 (2026-11). Stale entries only mean a coarser bucket. */
    private const CLOUDFLARE = [
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
        '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
        '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
        '2a06:98c0::/29', '2c0f:f248::/32',
    ];

    /** @param array<string,mixed> $server $_SERVER */
    public static function resolve(array $server): string
    {
        $peer = self::normalise((string) ($server['REMOTE_ADDR'] ?? ''));
        if ($peer === null) {
            return 'unknown';
        }
        if (!self::fromCloudflare($peer)) {
            return $peer;
        }
        // With "Pseudo IPv4: Overwrite headers", CF-Connecting-IP holds a fake 240.x address and the
        // real IPv6 address moves to CF-Connecting-IPv6.
        $ipv6 = self::normalise((string) ($server['HTTP_CF_CONNECTING_IPV6'] ?? ''));
        if ($ipv6 !== null && str_contains($ipv6, ':')) {
            return $ipv6;
        }
        return self::normalise((string) ($server['HTTP_CF_CONNECTING_IP'] ?? '')) ?? $peer;
    }

    /** IPv6 callers get one bucket per /64: a single host usually owns the whole /64. */
    public static function bucket(string $ip): string
    {
        if (!str_contains($ip, ':')) {
            return $ip;
        }
        $binary = @inet_pton($ip);
        if ($binary === false || strlen($binary) !== 16) {
            return $ip;
        }
        return (string) inet_ntop(substr($binary, 0, 8) . str_repeat("\0", 8)) . '/64';
    }

    public static function fromCloudflare(string $ip): bool
    {
        foreach (self::CLOUDFLARE as $cidr) {
            if (str_contains($cidr, ':') === str_contains($ip, ':') && self::inCidr($ip, $cidr)) {
                return true;
            }
        }
        return false;
    }

    public static function inCidr(string $ip, string $cidr): bool
    {
        [$network, $bits] = array_pad(explode('/', $cidr, 2), 2, null);
        $ipBinary = @inet_pton($ip);
        $networkBinary = @inet_pton((string) $network);
        if ($ipBinary === false || $networkBinary === false || strlen($ipBinary) !== strlen($networkBinary)) {
            return false;
        }
        $prefix = $bits === null ? strlen($ipBinary) * 8 : (int) $bits;
        $whole = intdiv($prefix, 8);
        if (strncmp($ipBinary, $networkBinary, $whole) !== 0) {
            return false;
        }
        $remainder = $prefix % 8;
        if ($remainder === 0) {
            return true;
        }
        $mask = (0xFF << (8 - $remainder)) & 0xFF;
        return (ord($ipBinary[$whole]) & $mask) === (ord($networkBinary[$whole]) & $mask);
    }

    /** Canonical text form, with IPv4-mapped IPv6 (::ffff:a.b.c.d) unwrapped; null if invalid. */
    private static function normalise(string $value): ?string
    {
        $value = trim($value);
        if ($value === '' || filter_var($value, FILTER_VALIDATE_IP) === false) {
            return null;
        }
        $binary = (string) inet_pton($value);
        if (strlen($binary) === 16 && str_starts_with($binary, str_repeat("\0", 10) . "\xff\xff")) {
            return (string) inet_ntop(substr($binary, 12));
        }
        return (string) inet_ntop($binary);
    }
}
