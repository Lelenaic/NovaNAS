<?php

namespace App\Services;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * Samba Service
 *
 * Provides methods for interacting with Samba (SMB) password storage.
 */
class SambaService
{
    /**
     * LinuxUserService instance.
     */
    protected LinuxUserService $linuxUserService;

    /**
     * Create a new Samba service instance.
     */
    public function __construct(LinuxUserService $linuxUserService)
    {
        $this->linuxUserService = $linuxUserService;
    }

    /**
     * Check if a Samba user exists in the system.
     */
    public function userExists(string $username): bool
    {
        $process = new Process(['sudo', 'pdbedit', '-L']);
        $process->run();

        if (!$process->isSuccessful()) {
            return false;
        }

        $lines = explode("\n", $process->getOutput());

        // pdbedit -L output format is: username:uid:gecos
        // We need to extract just the username (part before first colon)
        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (empty($trimmed)) {
                continue;
            }
            $parts = explode(':', $trimmed);
            if (isset($parts[0]) && $parts[0] === $username) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get the UID of a Linux user (required for Samba passdb format).
     */
    public function getUid(string $username): ?int
    {
        return $this->linuxUserService->getUid($username);
    }

    /**
     * Generate Samba NT (MD4) password hash from the user's password.
     *
     * @param string $password
     * @return string
     */
    public function generateNtHash(string $password): string
    {
        if (empty($password)) {
            return '';
        }

        // Convert UTF-8 to UTF-16LE
        $unicode = iconv('UTF-8', 'UTF-16LE', $password);

        // Compute MD4 hash, uppercase hex
        return strtoupper(bin2hex(hash('md4', $unicode, true)));
    }

    /**
     * Generate Samba LM (LAN Manager) hash.
     *
     * Note: LM hash is deprecated and we use a placeholder for NT-only auth.
     *
     * @return string
     */
    public function generateLmHash(): string
    {
        // LM hash is disabled for modern authentication
        // Using placeholder for NT-only authentication
        return 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    }

    /**
     * Create a Samba passdb line format.
     *
     * Format: username:uid:lm_hash:nt_hash:[U          ]:LCT-timestamp
     *
     * @param string $username
     * @param int $uid
     * @param string $ntHash
     * @return string
     */
    public function createPassdbLine(string $username, int $uid, string $ntHash): string
    {
        $lmHash = $this->generateLmHash();
        $timestamp = time();

        return sprintf(
            "%s:%d:%s:%s:[U          ]:LCT-%d",
            $username,
            $uid,
            $lmHash,
            $ntHash,
            $timestamp
        );
    }

    /**
     * Add or update a Samba user password.
     *
     * This method uses smbpasswd command to update the Samba password.
     * The -a flag adds or updates the user, -s reads from stdin.
     *
     * @param string $username The username
     * @param string $password The plain text password
     * @return bool True if successful
     * @throws \RuntimeException If the operation fails
     */
    public function updatePassword(string $username, string $password): bool
    {
        // Verify the user exists on the system
        if (!$this->linuxUserService->userExists($username)) {
            throw new \RuntimeException("Cannot update Samba password: user '{$username}' not found on system.");
        }

        // smbpasswd -a -s requires the password TWICE (new password + confirmation)
        // Each on a separate line
        $passwordWithConfirmation = $password . "\n" . $password . "\n";

        // Write password to temp file
        $tempFile = '/tmp/smbpass_' . uniqid() . '.tmp';
        file_put_contents($tempFile, $passwordWithConfirmation);
        chmod($tempFile, 0600);

        try {
            // Run smbpasswd with password from file
            $cmd = sprintf(
                'sudo smbpasswd -a -s %s < %s 2>&1',
                escapeshellarg($username),
                escapeshellarg($tempFile)
            );

            $output = shell_exec($cmd);

            // Check for errors in output
            if ($output && (strpos($output, 'Unable to get new password') !== false ||
                           strpos($output, 'Mismatch') !== false ||
                           strpos($output, 'error') !== false)) {
                @unlink($tempFile);
                throw new \RuntimeException("Failed to update Samba password: " . trim($output));
            }
        } catch (\Exception $e) {
            @unlink($tempFile);
            throw new \RuntimeException("Failed to update Samba password: " . $e->getMessage());
        }

        // Clean up
        @unlink($tempFile);

        return true;
    }

    /**
     * Delete a Samba user.
     *
     * @param string $username The username to delete
     * @return bool True if successful
     * @throws \RuntimeException If deletion fails
     */
    public function deleteUser(string $username): bool
    {
        if (!$this->userExists($username)) {
            return true;
        }

        $process = new Process(['sudo', 'pdbedit', '-x', '-u', $username]);

        try {
            $process->mustRun();
        } catch (ProcessFailedException $e) {
            throw new \RuntimeException("Failed to delete Samba user '{$username}': " . $process->getErrorOutput());
        }

        return true;
    }

    /**
     * Clean up temporary file.
     *
     * @param string $tempFile
     * @return void
     */
    protected function cleanupTempFile(string $tempFile): void
    {
        $process = new Process(['sudo', 'rm', '-f', $tempFile]);
        $process->run();
    }
}
