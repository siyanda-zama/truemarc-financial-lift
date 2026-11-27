<?php

declare(strict_types=1);

namespace DeployKit;

use PharData;
use Throwable;
use ZipArchive;

/**
 * Validates and unpacks a release archive (the zip the deploy workflow packs).
 *
 * Validation reads the zip's central directory itself, so it is the same whichever extractor runs.
 * Every entry must be a plain file or folder under public_html/, app/ or root/ (or manifest.json), with a
 * relative, normalised name: no absolute paths, drive letters, backslashes, "." or ".." segments, control
 * characters or symlinks, nothing encrypted, no zip64, no duplicates, and only "stored" or "deflate".
 * Server-only names (.env, the persistent folders, the switch slots) are refused too. Files are then
 * written by this class to the validated names inside the target folder, never through
 * ZipArchive::extractTo(), so nothing can land outside it.
 *
 * Extractors: ZipArchive (ext-zip), or PharData (ext-phar + zlib) where zip is missing.
 */
final class ArchiveExtractor
{
    public const MAX_ENTRIES = 30000;
    public const MAX_UNPACKED_BYTES = 1024 * 1024 * 1024;

    /** Top-level names a release archive may contain. */
    private const TOP_LEVEL = ['public_html', 'app', 'root', 'manifest.json'];

    public static function available(): ?string
    {
        if (class_exists(ZipArchive::class)) {
            return 'zip';
        }
        return class_exists(PharData::class) && extension_loaded('zlib') ? 'phar' : null;
    }

    /** Why an entry name is unsafe as a path, or null when it is fine. Directory names end with "/". */
    public static function unsafeName(string $name): ?string
    {
        if ($name === '' || $name === '/') {
            return 'empty name';
        }
        if (strlen($name) > 1024) {
            return 'name too long';
        }
        if (preg_match('/[\x00-\x1f\x7f]/', $name) === 1) {
            return 'control character in name';
        }
        if (preg_match('//u', $name) !== 1) {
            return 'name is not UTF-8';
        }
        if (str_contains($name, '\\')) {
            return 'backslash in name';
        }
        if ($name[0] === '/' || preg_match('/^[A-Za-z]:/', $name) === 1) {
            return 'absolute path';
        }
        foreach (explode('/', str_ends_with($name, '/') ? substr($name, 0, -1) : $name) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return 'path traversal or empty segment';
            }
        }
        return null;
    }

    /** Why a (safe) name must not be part of a release, or null. */
    public static function forbiddenName(string $name): ?string
    {
        $path = rtrim($name, '/');
        $top = explode('/', $path)[0];
        if (!in_array($top, self::TOP_LEVEL, true)) {
            return 'unexpected top-level entry (only public_html/, app/, root/ and manifest.json)';
        }
        if ($path === 'manifest.json' && str_ends_with($name, '/')) {
            return 'unexpected top-level entry';
        }
        // These are served from the real document root, never from a release: a copy in the release would
        // be dead weight at best, and would shadow the server's own files at worst.
        if (preg_match('#^public_html/(media|_current|_previous|_deploy|\.well-known|cgi-bin)(/|$)#', $path) === 1) {
            return 'server-only folder in public_html';
        }
        if ($path === 'public_html/' . ReleaseManager::MARKER) {
            return 'reserved release marker';
        }
        if (preg_match('#^root/(media|_current|_previous|_deploy|\.well-known|cgi-bin|\.user\.ini|php\.ini|error_log|\.ftpquota)(/|$)#', $path) === 1) {
            return 'server-managed name in root';
        }
        if (preg_match('#(^|/)\.env(\.(?!example$)[^/]*)?$#', $path) === 1) {
            return 'environment file';
        }
        if (preg_match('#(^|/)\.(git|svn|hg)(/|$)#', $path) === 1) {
            return 'version-control data';
        }
        // A .htaccess inside the served tree would be read on Apache's second pass through _current/ and
        // can undo the routing and the blocks. The site's rules come from root/.htaccess only.
        if (basename($path) === '.htaccess' && $path !== 'root/.htaccess' && $top !== 'app') {
            return '.htaccess outside root/.htaccess';
        }
        return null;
    }

    /**
     * Reads and validates the central directory.
     *
     * @return list<array{name:string,dir:bool,size:int,method:int}>
     * @throws ReleaseException
     */
    public static function inspect(string $archive): array
    {
        $handle = @fopen($archive, 'rb');
        if ($handle === false) {
            throw new ReleaseException('archive_unreadable', 'The release archive cannot be opened.', 422);
        }
        try {
            $size = (int) fstat($handle)['size'];
            $tailLength = min($size, 65557);
            if ($tailLength < 22) {
                throw new ReleaseException('unsafe_archive', 'The release archive is not a zip file.', 422);
            }
            fseek($handle, $size - $tailLength);
            $tail = (string) fread($handle, $tailLength);
            $eocd = strrpos($tail, "PK\x05\x06");
            if ($eocd === false || strlen($tail) - $eocd < 22) {
                throw new ReleaseException('unsafe_archive', 'The release archive is not a zip file (no end of central directory).', 422);
            }
            $end = unpack('vdisk/vcdDisk/vdiskEntries/ventries/VcdSize/VcdOffset/vcommentLength', substr($tail, $eocd + 4, 18));
            if ($end === false || $end['disk'] !== 0 || $end['cdDisk'] !== 0 || $end['diskEntries'] !== $end['entries']) {
                throw new ReleaseException('unsafe_archive', 'Multi-part zip archives are not supported.', 422);
            }
            if ($end['entries'] === 0xFFFF || $end['cdOffset'] === 0xFFFFFFFF || $end['cdSize'] === 0xFFFFFFFF) {
                throw new ReleaseException('unsafe_archive', 'Zip64 archives are not supported.', 422);
            }
            if ($end['entries'] > self::MAX_ENTRIES) {
                throw new ReleaseException('unsafe_archive', 'The release archive has too many entries.', 422);
            }
            if ($end['cdOffset'] + $end['cdSize'] > $size) {
                throw new ReleaseException('unsafe_archive', 'The release archive is truncated.', 422);
            }
            fseek($handle, $end['cdOffset']);
            $directory = $end['cdSize'] > 0 ? (string) fread($handle, $end['cdSize']) : '';
        } finally {
            fclose($handle);
        }

        $entries = [];
        $seen = [];
        $public = false;
        $total = 0;
        $offset = 0;
        for ($i = 0; $i < $end['entries']; $i++) {
            if (strlen($directory) - $offset < 46 || substr($directory, $offset, 4) !== "PK\x01\x02") {
                throw new ReleaseException('unsafe_archive', 'The release archive has a damaged central directory.', 422);
            }
            $header = unpack('vmadeBy/vneeded/vflags/vmethod/vtime/vdate/Vcrc/VcompressedSize/Vsize/vnameLength/vextraLength/vcommentLength/vdiskStart/vinternal/Vexternal/VlocalOffset', substr($directory, $offset + 4, 42));
            if ($header === false) {
                throw new ReleaseException('unsafe_archive', 'The release archive has a damaged central directory.', 422);
            }
            $name = substr($directory, $offset + 46, $header['nameLength']);
            $offset += 46 + $header['nameLength'] + $header['extraLength'] + $header['commentLength'];
            $label = self::label($name);

            if (($reason = self::unsafeName($name)) !== null) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: {$reason}.", 422);
            }
            if (($reason = self::forbiddenName($name)) !== null) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: {$reason}.", 422);
            }
            if (($header['flags'] & 0x1) !== 0) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: encrypted.", 422);
            }
            if (!in_array($header['method'], [0, 8], true)) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: unsupported compression.", 422);
            }
            if ($header['size'] === 0xFFFFFFFF || $header['compressedSize'] === 0xFFFFFFFF) {
                throw new ReleaseException('unsafe_archive', 'Zip64 entries are not supported.', 422);
            }
            $dir = str_ends_with($name, '/');
            // Unix "made by": the high 16 bits of the external attributes are the file mode.
            if (($header['madeBy'] >> 8) === 3) {
                $type = ($header['external'] >> 16) & 0xF000;
                if ($type === 0xA000) {
                    throw new ReleaseException('unsafe_archive', "Refused entry {$label}: symbolic link.", 422);
                }
                if ($type !== 0 && $type !== 0x8000 && $type !== 0x4000) {
                    throw new ReleaseException('unsafe_archive', "Refused entry {$label}: not a regular file or folder.", 422);
                }
                if ($type === 0x4000 && !$dir) {
                    throw new ReleaseException('unsafe_archive', "Refused entry {$label}: folder without a trailing slash.", 422);
                }
            }
            if ($dir && $header['size'] !== 0) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: folder with content.", 422);
            }
            $key = rtrim($name, '/');
            if (isset($seen[$key])) {
                throw new ReleaseException('unsafe_archive', "Refused entry {$label}: duplicate name.", 422);
            }
            $seen[$key] = true;
            $public = $public || str_starts_with($name, 'public_html/');
            $total += $header['size'];
            if ($total > self::MAX_UNPACKED_BYTES) {
                throw new ReleaseException('unsafe_archive', 'The release archive unpacks to more than the size limit.', 422);
            }
            $entries[] = ['name' => $name, 'dir' => $dir, 'size' => $header['size'], 'method' => $header['method']];
        }
        if (!$public) {
            throw new ReleaseException('unsafe_archive', 'The release archive has no public_html/.', 422);
        }
        if (!isset($seen['root/.htaccess'])) {
            throw new ReleaseException('unsafe_archive', 'The release archive has no root/.htaccess (the workflow adds the kit template).', 422);
        }
        return $entries;
    }

    /**
     * Validates the archive, then writes every entry into $target (which must not exist yet).
     *
     * @return array{extractor:string,files:int,folders:int,bytes:int}
     * @throws ReleaseException
     */
    public static function extract(string $archive, string $target, ?string $extractor = null): array
    {
        $entries = self::inspect($archive);
        $extractor ??= self::available();
        if ($extractor === null) {
            throw new ReleaseException('extractor_unavailable', 'PHP has neither the zip nor the phar extension; zip releases are not possible on this server.', 501);
        }
        if (file_exists($target) || !@mkdir($target, 0755, true)) {
            throw new ReleaseException('extract_failed', 'The release folder could not be created.', 500);
        }
        $target = rtrim($target, '/');

        $zip = null;
        if ($extractor === 'zip') {
            $zip = new ZipArchive();
            if ($zip->open($archive) !== true || $zip->numFiles !== count($entries)) {
                throw new ReleaseException('extract_failed', 'ZipArchive could not open the release archive.', 500);
            }
        } elseif ($extractor === 'phar') {
            try {
                new PharData($archive); // parses the archive; reading goes through phar:// below
            } catch (Throwable) {
                throw new ReleaseException('extract_failed', 'PharData could not open the release archive.', 500);
            }
        } else {
            throw new ReleaseException('extractor_unavailable', 'Unknown extractor.', 500);
        }

        $stats = ['extractor' => $extractor, 'files' => 0, 'folders' => 0, 'bytes' => 0];
        try {
            foreach ($entries as $index => $entry) {
                $path = $target . '/' . rtrim($entry['name'], '/');
                if ($entry['dir']) {
                    if (!is_dir($path) && !@mkdir($path, 0755, true)) {
                        throw new ReleaseException('extract_failed', 'Could not create folder ' . self::label($entry['name']) . '.', 500);
                    }
                    $stats['folders']++;
                    continue;
                }
                $parent = dirname($path);
                if (!is_dir($parent) && !@mkdir($parent, 0755, true)) {
                    throw new ReleaseException('extract_failed', 'Could not create folder for ' . self::label($entry['name']) . '.', 500);
                }
                if ($zip !== null) {
                    if (($zip->statIndex($index)['name'] ?? null) !== $entry['name']) {
                        throw new ReleaseException('unsafe_archive', 'The zip index does not match its central directory.', 422);
                    }
                    $in = method_exists($zip, 'getStreamIndex') ? $zip->getStreamIndex($index) : $zip->getStream($entry['name']);
                } else {
                    $in = @fopen('phar://' . $archive . '/' . $entry['name'], 'rb');
                }
                // "x": never overwrite (a duplicate or a file/folder clash fails instead).
                $out = @fopen($path, 'xb');
                if ($in === false || $in === null || $out === false) {
                    throw new ReleaseException('extract_failed', 'Could not unpack ' . self::label($entry['name']) . '.', 500);
                }
                $written = stream_copy_to_stream($in, $out);
                fclose($in);
                $closed = fclose($out);
                if ($written !== $entry['size'] || !$closed) {
                    throw new ReleaseException('extract_failed', 'Size mismatch while unpacking ' . self::label($entry['name']) . '.', 500);
                }
                @chmod($path, 0644);
                $stats['files']++;
                $stats['bytes'] += $written;
            }
        } finally {
            $zip?->close();
        }
        return $stats;
    }

    /** A short, printable form of an entry name for error messages. */
    private static function label(string $name): string
    {
        $clean = preg_replace('/[^\x20-\x7e]/', '?', $name) ?? '?';
        return '"' . (strlen($clean) > 80 ? substr($clean, 0, 77) . '...' : $clean) . '"';
    }
}
