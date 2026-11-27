<?php

declare(strict_types=1);

namespace DeployKit;

/**
 * Builds the live document-root .htaccess from a release's root/.htaccess (the server-side twin of
 * .github/scripts/merge-cpanel-htaccess.sh).
 *
 * - Keeps every block cPanel wrote into the live file ("# ... BEGIN cPanel-generated ..." to
 *   "# ... END cPanel-generated ..."). MultiPHP Manager stores the site's PHP version there and the
 *   MultiPHP INI Editor its directives; without them the site silently drops to the server's default PHP.
 *   A block whose BEGIN line the release already has is not added twice (so a build can pin one).
 * - Optional: if the release's CSP lists inline-script hashes (script-src 'self' 'sha256-...'), the hashes
 *   of every kept release are allowed too, so pages of the release before (a rollback, or a page loaded
 *   just before a switch) keep working. Without such a list nothing changes.
 */
final class HtaccessComposer
{
    private const HASH_LIST = "/script-src 'self'((?: '(?:sha256|sha384|sha512)-[A-Za-z0-9+\\/=]+')*)/";
    private const HASH_TOKEN = "/'(?:sha256|sha384|sha512)-[A-Za-z0-9+\\/=]+'/";

    /** @param list<string> $extraHashes CSP tokens such as 'sha256-...' from other kept releases */
    public static function compose(string $release, ?string $live, array $extraHashes = []): string
    {
        $release = self::withHashes($release, $extraHashes);
        $blocks = $live === null ? [] : self::cpanelBlocks($live, $release);
        if ($blocks === []) {
            return $release;
        }
        return rtrim($release, "\n") . "\n\n# Preserved from the server by the deploy receiver (cPanel-managed; change these in cPanel, not here).\n"
            . implode("\n", $blocks) . "\n";
    }

    /** @return list<string> cPanel-generated blocks of $live whose BEGIN line is not already in $target */
    public static function cpanelBlocks(string $live, string $target): array
    {
        $have = array_flip(preg_split('/\r?\n/', $target) ?: []);
        $blocks = [];
        foreach (self::blocks($live) as $begin => $block) {
            if (!isset($have[$begin])) {
                $blocks[] = $block;
            }
        }
        return $blocks;
    }

    /**
     * For restoring an old .htaccess (rollback to the site from before the first release): its cPanel blocks
     * are replaced in place by the live ones with the same BEGIN line, and live blocks it lacks are appended.
     * cPanel may have changed the PHP version since; the old file must not undo that. With unchanged blocks
     * the result is the old file byte for byte.
     */
    public static function refreshCpanelBlocks(string $old, ?string $live): string
    {
        if ($live === null) {
            return $old;
        }
        $current = self::blocks($live);
        $lines = preg_split('/(?<=\n)/', $old) ?: [];
        $out = '';
        $skipping = false;
        $used = [];
        foreach ($lines as $line) {
            $bare = rtrim($line, "\r\n");
            if (!$skipping && str_contains($bare, 'BEGIN cPanel-generated') && isset($current[$bare])) {
                $out .= $current[$bare] . (str_ends_with($line, "\n") ? "\n" : '');
                $used[$bare] = true;
                $skipping = !str_contains($bare, 'END cPanel-generated');
                continue;
            }
            if ($skipping) {
                if (str_contains($bare, 'END cPanel-generated')) {
                    $skipping = false;
                }
                continue;
            }
            $out .= $line;
        }
        $missing = array_diff_key($current, $used);
        if ($missing !== []) {
            $out = rtrim($out, "\n") . "\n\n" . implode("\n", $missing) . "\n";
        }
        return $out;
    }

    /** @return list<string> the 'sha256-...' tokens allowed for scripts */
    public static function scriptHashes(string $htaccess): array
    {
        if (preg_match(self::HASH_LIST, $htaccess, $match) !== 1) {
            return [];
        }
        preg_match_all(self::HASH_TOKEN, $match[1], $tokens);
        return $tokens[0];
    }

    /** @return array<string,string> BEGIN line => the whole block, in file order */
    private static function blocks(string $htaccess): array
    {
        $blocks = [];
        $current = null;
        $begin = '';
        foreach (preg_split('/\r?\n/', $htaccess) ?: [] as $line) {
            if (str_contains($line, 'BEGIN cPanel-generated')) {
                $current = [];
                $begin = $line;
            }
            if ($current !== null) {
                $current[] = $line;
                if (str_contains($line, 'END cPanel-generated')) {
                    $blocks[$begin] ??= implode("\n", $current);
                    $current = null;
                }
            }
        }
        return $blocks;
    }

    /** @param list<string> $extraHashes */
    private static function withHashes(string $htaccess, array $extraHashes): string
    {
        $extra = array_values(array_filter($extraHashes, static fn (string $token): bool => preg_match('/^' . trim(self::HASH_TOKEN, '/') . '$/', $token) === 1));
        if ($extra === [] || preg_match(self::HASH_LIST, $htaccess) !== 1) {
            return $htaccess;
        }
        return (string) preg_replace_callback(
            self::HASH_LIST,
            static function (array $match) use ($extra): string {
                preg_match_all(self::HASH_TOKEN, $match[1], $own);
                return "script-src 'self' " . implode(' ', array_values(array_unique([...$own[0], ...$extra])));
            },
            $htaccess,
            1,
        );
    }
}
