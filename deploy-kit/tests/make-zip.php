<?php

declare(strict_types=1);

// A minimal zip writer (stored entries) with full control over names, Unix modes and header flags, so the
// tests can build archives no real zip tool would: "../" names, symlink entries, encrypted flags, zip64 markers.
//
//   php make-zip.php <out.zip> < spec.json
//   spec: [{"name": "public_html/index.html", "data": "<html>", "mode": 33188, "flags": 0, "method": 0}, ...]
//   or {"entries": [...], "eocd_entries": 65535} to fake a zip64 end record.

$out = $argv[1] ?? '';
if ($out === '') {
    fwrite(STDERR, "usage: php make-zip.php <out.zip> < spec.json\n");
    exit(2);
}
$spec = json_decode((string) stream_get_contents(STDIN), true);
$entries = is_array($spec['entries'] ?? null) ? $spec['entries'] : $spec;
$local = '';
$central = '';
foreach ($entries as $entry) {
    $name = (string) $entry['name'];
    $data = (string) ($entry['data'] ?? '');
    $mode = (int) ($entry['mode'] ?? (str_ends_with($name, '/') ? 040755 : 0100644));
    $flags = (int) ($entry['flags'] ?? 0);
    $method = (int) ($entry['method'] ?? 0);
    $crc = crc32($data);
    $size = strlen($data);
    $offset = strlen($local);
    $local .= pack('VvvvvvVVVvv', 0x04034b50, 20, $flags, $method, 0, 0x21, $crc, $size, $size, strlen($name), 0) . $name . $data;
    // "made by" 0x031E = Unix, so the high 16 bits of the external attributes are the file mode.
    $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 0x031E, 20, $flags, $method, 0, 0x21, $crc, $size, $size, strlen($name), 0, 0, 0, 0, ($mode << 16) & 0xFFFFFFFF, $offset) . $name;
}
$count = (int) ($spec['eocd_entries'] ?? count($entries));
file_put_contents($out, $local . $central . pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, strlen($central), strlen($local), 0));
echo hash_file('sha256', $out), "\n";
