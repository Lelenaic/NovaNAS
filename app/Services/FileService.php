<?php

namespace App\Services;

use Illuminate\Support\Facades\Process;

/**
 * File Service
 *
 * Provides methods for listing directory contents using sudo
 * to ensure proper permission handling as the connected user.
 */
class FileService
{
    /**
     * List directory contents as the specified user.
     *
     * Uses sudo -u to execute ls as the user, ensuring the webserver
     * user's limited permissions don't block access to user-owned directories.
     *
     * @return array<int, array{name: string, path: string, isDirectory: bool}>
     */
    public function listDirectory(string $path, string $username): array
    {
        $escapedPath = escapeshellarg($path);
        $escapedUsername = escapeshellarg($username);
        $result = Process::run("sudo -u {$escapedUsername} ls -1F {$escapedPath} 2>/dev/null");

        if (! $result->successful()) {
            return [];
        }

        $lines = array_filter(explode("\n", trim($result->output())));
        $items = [];

        foreach ($lines as $entry) {
            if ($entry === '' || $entry === './' || $entry === '../') {
                continue;
            }

            // ls -1F appends / to dirs, * to executables, @ to symlinks, | to pipes, = to sockets
            $isDirectory = str_ends_with($entry, '/');
            $name = rtrim($entry, '/@*|=');
            $fullPath = $path === '/' ? '/'.$name : $path.'/'.$name;

            $items[] = [
                'name' => $name,
                'path' => $fullPath,
                'isDirectory' => $isDirectory,
            ];
        }

        // Sort: directories first, then alphabetically
        usort($items, function ($a, $b) {
            if ($a['isDirectory'] !== $b['isDirectory']) {
                return $a['isDirectory'] ? -1 : 1;
            }

            return strcasecmp($a['name'], $b['name']);
        });

        return $items;
    }

    /**
     * List directory contents with file details (size, modified) as the specified user.
     *
     * @return array<int, array{name: string, path: string, type: string, size?: int, modified?: string}>
     */
    public function listDirectoryWithDetails(string $path, string $username): array
    {
        $escapedPath = escapeshellarg($path);
        $escapedUsername = escapeshellarg($username);
        $result = Process::run("sudo -u {$escapedUsername} ls -1F {$escapedPath} 2>/dev/null");

        if (! $result->successful()) {
            return [];
        }

        $lines = array_filter(explode("\n", trim($result->output())));
        $items = [];

        foreach ($lines as $entry) {
            if ($entry === '' || $entry === './' || $entry === '../') {
                continue;
            }

            $isDirectory = str_ends_with($entry, '/');
            $name = rtrim($entry, '/@*|=');
            $fullPath = $path === '/' ? '/'.$name : $path.'/'.$name;

            $item = [
                'name' => $name,
                'path' => $fullPath,
                'type' => $isDirectory ? 'directory' : 'file',
            ];

            if (! $isDirectory) {
                $statResult = Process::run("sudo -u {$escapedUsername} stat -c '%s %Y' ".escapeshellarg($fullPath).' 2>/dev/null');

                if ($statResult->successful()) {
                    $parts = explode(' ', trim($statResult->output()));
                    if (count($parts) === 2) {
                        $item['size'] = (int) $parts[0];
                        $item['modified'] = date('Y-m-d H:i:s', (int) $parts[1]);
                    }
                }
            }

            $items[] = $item;
        }

        // Sort: directories first, then by name
        usort($items, function ($a, $b) {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'directory' ? -1 : 1;
            }

            return strcasecmp($a['name'], $b['name']);
        });

        return $items;
    }
}
