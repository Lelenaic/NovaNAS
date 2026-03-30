<?php

namespace App\Services;

use Symfony\Component\Process\Process;

/**
 * ACL Service
 *
 * Manages POSIX filesystem ACLs using setfacl/getfacl.
 * Provides per-user read/readwrite permissions on share paths.
 */
class AclService
{
    /**
     * Apply user permissions to a path.
     *
     * @param  string  $path  Absolute path to the share directory
     * @param  array<string, string>  $userPermissions  ['username' => 'read'|'readwrite']
     *
     * @throws \RuntimeException
     */
    public function applyPermissions(string $path, array $userPermissions): void
    {
        if (! is_dir($path)) {
            throw new \RuntimeException("Path '{$path}' is not a directory");
        }

        // Get current ACL users
        $currentPermissions = $this->getPermissions($path);

        // Remove ACL entries for users no longer in the permission list
        foreach ($currentPermissions as $username => $_level) {
            if (! array_key_exists($username, $userPermissions) || $userPermissions[$username] === 'none') {
                $this->removeUserPermission($path, $username);
            }
        }

        // Apply new permissions
        foreach ($userPermissions as $username => $level) {
            if ($level === 'none') {
                $this->removeUserPermission($path, $username);
            } else {
                $this->setUserPermission($path, $username, $level);
            }
        }
    }

    /**
     * Get current user permissions from a path's ACLs.
     *
     * @param  string  $path  Absolute path
     * @return array<string, string> ['username' => 'read'|'readwrite']
     */
    public function getPermissions(string $path): array
    {
        if (! is_dir($path) && ! is_file($path)) {
            return [];
        }

        $process = new Process(['sudo', 'getfacl', '-p', '-c', $path]);
        $process->run();

        if (! $process->isSuccessful()) {
            return [];
        }

        $permissions = [];
        $lines = explode("\n", trim($process->getOutput()));

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Match user ACL entries: user:username:rwx or user:username:r-x
            if (preg_match('/^user:([^:]+):([rwx-]+)$/', $trimmed, $matches)) {
                $username = $matches[1];
                $perms = $matches[2];

                // Skip default/empty username entries (owner)
                if (empty($username)) {
                    continue;
                }

                // Determine permission level from the perm string
                $hasWrite = str_contains($perms, 'w');
                $hasRead = str_contains($perms, 'r');

                if ($hasWrite && $hasRead) {
                    $permissions[$username] = 'readwrite';
                } elseif ($hasRead) {
                    $permissions[$username] = 'read';
                }
            }
        }

        return $permissions;
    }

    /**
     * Set a user's permission on a path (recursive + default ACLs).
     *
     * @param  string  $path  Absolute path
     * @param  string  $username  Linux username
     * @param  string  $level  'read' or 'readwrite'
     *
     * @throws \RuntimeException
     */
    protected function setUserPermission(string $path, string $username, string $level): void
    {
        if ($level === 'read') {
            $this->runCommand([
                'sudo', 'setfacl', '-R',
                '-m', "u:{$username}:r-X",
                '-m', "d:u:{$username}:r-x",
                $path
            ]);
        } elseif ($level === 'readwrite') {
            $this->runCommand([
                'sudo', 'setfacl', '-R',
                '-m', "u:{$username}:rwX",
                '-m', "d:u:{$username}:rwx",
                $path
            ]);
        }
    }

    /**
     * Remove a user's ACL entries from a path.
     *
     * @param  string  $path  Absolute path
     * @param  string  $username  Linux username
     */
    protected function removeUserPermission(string $path, string $username): void
    {
        // Remove named user ACL entry (recursively)
        $process = new Process(['sudo', 'setfacl', '-R', '-x', "u:{$username}", $path]);
        $process->run();

        // Also remove default ACL entries for this user on directories
        $process = new Process([
            'sudo', 'find', $path, '-type', 'd',
            '-exec', 'setfacl', '-x', "d:u:{$username}", '{}', '+',
        ]);
        $process->run();
    }

    /**
     * Run a command and throw on failure.
     *
     * @throws \RuntimeException
     */
    protected function runCommand(array $command): void
    {
        $process = new Process($command);
        $process->run();

        if (! $process->isSuccessful()) {
            \Illuminate\Support\Facades\Log::warning('[AclService] Command failed: '.implode(' ', $command), [
                'stderr' => $process->getErrorOutput(),
                'exit_code' => $process->getExitCode(),
            ]);
        }
    }
}
