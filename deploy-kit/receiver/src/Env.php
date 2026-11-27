<?php

declare(strict_types=1);

namespace DeployKit;

/**
 * Reads ~/<APP_DIR>/.env (dotenv style). The receiver never looks at real environment variables: cPanel
 * PHP does not set any, and a stray one must not be able to switch the hook on.
 *
 * Values:
 *  - "double" or 'single' quoted: the text between the quotes (anything after the closing quote is ignored);
 *  - unquoted: an inline comment that starts with whitespace + # is dropped, then whitespace is trimmed.
 *    `DB_USERNAME=abc_app   # note` is `abc_app`. (Keeping the comment once broke production DB auth.)
 *    A # with no space before it is kept, so `pa#ss` still works.
 * An `export ` prefix, CRLF line endings and a UTF-8 BOM (cPanel's editor can save one) are accepted.
 */
final class Env
{
    /** @return array<string,string> */
    public static function load(string $path): array
    {
        if (!is_file($path)) {
            return [];
        }
        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $values = [];
        foreach ($lines === false ? [] : $lines as $index => $line) {
            if ($index === 0 && str_starts_with($line, "\xEF\xBB\xBF")) {
                $line = substr($line, 3);
            }
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            $key = trim((string) preg_replace('/^export\s+/', '', trim($key)));
            if ($key !== '' && preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $key) === 1) {
                $values[$key] = self::parseValue($value);
            }
        }
        return $values;
    }

    public static function parseValue(string $raw): string
    {
        $value = trim($raw);
        $quote = $value[0] ?? '';
        if (($quote === '"' || $quote === "'") && ($end = strpos($value, $quote, 1)) !== false) {
            return substr($value, 1, $end - 1);
        }
        return trim((string) preg_replace('/\s+#.*$/', '', $value));
    }
}
