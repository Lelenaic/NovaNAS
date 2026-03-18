<?php

namespace App\Services;

use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

/**
 * Samba Service
 *
 * Provides methods for interacting with Samba (SMB) configuration and password storage.
 */
class SambaService
{
    /**
     * Path to the Samba configuration file.
     */
    protected const SMBCONF_PATH = '/etc/samba/smb.conf';

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
     * Determine if a share is enabled based on its properties.
     * For homes share, it's enabled if the section exists in config.
     */
    protected function isShareEnabled(array $share): bool
    {
        // For homes share, it's enabled if it exists in the config
        if ($share['name'] === 'homes') {
            return true;
        }

        // For custom shares, they're always enabled if they exist
        return $share['type'] === 'custom';
    }

    /**
     * Parse the smb.conf file and return all shares.
     * Homes is enabled if the [homes] section exists in config.
     *
     * @return array<int, array{name: string, type: string, comment: ?string, path: ?string, writable: ?string, guest: ?string, 'valid users': ?string, 'create mask': ?string, 'directory mask': ?string, browseable: ?string, 'read only': ?string, enabled: bool}>
     */
    public function getShares(): array
    {
        if (!file_exists(self::SMBCONF_PATH)) {
            return [];
        }

        $content = file_get_contents(self::SMBCONF_PATH);
        if ($content === false) {
            return [];
        }

        $lines = explode("\n", $content);
        $shares = [];
        $currentShare = null;
        $inGlobal = false;
        $homesInConfig = false;

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Skip empty lines and comments
            if (empty($trimmed) || $trimmed[0] === ';' || $trimmed[0] === '#') {
                continue;
            }

            // Check for section headers (share names in brackets)
            if (preg_match('/^\[([^\]]+)\]$/', $trimmed, $matches)) {
                // Save previous share if exists
                if ($currentShare !== null) {
                    $shares[] = $currentShare;
                }

                $shareName = $matches[1];
                $inGlobal = ($shareName === 'global');

                // Skip [global] section - it's not a share
                if ($inGlobal) {
                    $currentShare = null;
                    continue;
                }

                $shareType = $this->getShareType($shareName);

                // Track if homes exists in config
                if ($shareName === 'homes') {
                    $homesInConfig = true;
                }

                // Custom and system shares are always enabled if they exist
                // Homes is enabled if it exists in config
                $isEnabled = ($shareType === 'custom' || $shareType === 'system');

                $currentShare = [
                    'name' => $shareName,
                    'type' => $shareType,
                    'comment' => null,
                    'path' => null,
                    'writable' => null,
                    'guest' => null,
                    'valid users' => null,
                    'create mask' => null,
                    'directory mask' => null,
                    'browseable' => null,
                    'read only' => null,
                    'enabled' => $isEnabled,
                ];
                continue;
            }

            // Parse key = value pairs
            if ($currentShare !== null && strpos($trimmed, '=') !== false) {
                list($key, $value) = array_map('trim', explode('=', $trimmed, 2));

                // Map common variations
                $keyMap = [
                    'comment' => 'comment',
                    'path' => 'path',
                    'writable' => 'writable',
                    'guest ok' => 'guest',
                    'guest' => 'guest',
                    'valid users' => 'valid users',
                    'create mask' => 'create mask',
                    'create mode' => 'create mask',
                    'directory mask' => 'directory mask',
                    'directory mode' => 'directory mask',
                    'browseable' => 'browseable',
                    'read only' => 'read only',
                ];

                $normalizedKey = $keyMap[$key] ?? $key;

                if (array_key_exists($normalizedKey, $currentShare)) {
                    $currentShare[$normalizedKey] = $value;
                }
            }
        }

        // Add last share
        if ($currentShare !== null) {
            $shares[] = $currentShare;
        }

        // If homes doesn't exist in config, add it as disabled
        if (!$homesInConfig) {
            $shares[] = [
                'name' => 'homes',
                'type' => 'homes',
                'comment' => 'Home Directories',
                'path' => null,
                'writable' => null,
                'guest' => null,
                'valid users' => '%S',
                'create mask' => null,
                'directory mask' => null,
                'browseable' => null,
                'read only' => 'yes',
                'enabled' => false,
            ];
        } else {
            // Homes exists in config - it's enabled
            foreach ($shares as &$share) {
                if ($share['name'] === 'homes') {
                    $share['enabled'] = true;
                    break;
                }
            }
        }

        // Sort to put homes first
        usort($shares, function ($a, $b) {
            if ($a['name'] === 'homes') {
                return -1;
            }
            if ($b['name'] === 'homes') {
                return 1;
            }
            return strcmp($a['name'], $b['name']);
        });

        return $shares;
    }

    /**
     * Determine the type of share.
     */
    protected function getShareType(string $name): string
    {
        if ($name === 'homes') {
            return 'homes';
        }

        if (in_array($name, ['printers', 'print$'], true)) {
            return 'system';
        }

        return 'custom';
    }

    /**
     * Get a specific share by name.
     */
    public function getShare(string $name): ?array
    {
        $shares = $this->getShares();

        foreach ($shares as $share) {
            if ($share['name'] === $name) {
                return $share;
            }
        }

        return null;
    }

    /**
     * Create a new share in smb.conf.
     *
     * @param array{comment?: string, path: string, writable?: string, guest?: string, 'valid users'?: string} $config
     * @return bool
     * @throws \RuntimeException
     */
    public function createShare(string $name, array $config): bool
    {
        // Check if share already exists
        if ($this->getShare($name) !== null) {
            throw new \RuntimeException("Share '{$name}' already exists");
        }

        // Validate required fields
        if (empty($config['path'])) {
            throw new \RuntimeException('Path is required for share creation');
        }

        // Read current config
        $content = file_get_contents(self::SMBCONF_PATH);
        if ($content === false) {
            throw new \RuntimeException('Unable to read smb.conf');
        }

        // Build share configuration
        $shareConfig = "\n[{$name}]\n";
        $shareConfig .= $this->buildShareConfig($config);

        // Append to config
        $newContent = $content . $shareConfig;

        // Write to temp file first
        $tempFile = '/tmp/smb.conf.' . uniqid();
        if (file_put_contents($tempFile, $newContent) === false) {
            throw new \RuntimeException('Unable to write temporary config');
        }

        // Validate with testparm
        $process = new Process(['sudo', 'testparm', '-s', $tempFile]);
        $process->run();

        if (!$process->isSuccessful()) {
            unlink($tempFile);
            throw new \RuntimeException('Invalid smb.conf: ' . $process->getErrorOutput());
        }

        // Move to actual location
        $process = new Process(['sudo', 'mv', $tempFile, self::SMBCONF_PATH]);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new \RuntimeException('Failed to update smb.conf: ' . $process->getErrorOutput());
        }

        // Restart Samba
        return $this->restartSmb();
    }

    /**
     * Update an existing share.
     *
     * @param array{comment?: string|null, path?: string|null, writable?: string|null, guest?: string|null, 'valid users'?: string|null} $config
     * @return bool
     * @throws \RuntimeException
     */
    public function updateShare(string $name, array $config): bool
    {
        $shares = $this->getShares();
        $shareIndex = null;

        foreach ($shares as $index => $share) {
            if ($share['name'] === $name) {
                $shareIndex = $index;
                break;
            }
        }

        if ($shareIndex === null) {
            throw new \RuntimeException("Share '{$name}' not found");
        }

        // Cannot edit system shares
        if ($shares[$shareIndex]['type'] === 'system') {
            throw new \RuntimeException('Cannot modify system shares');
        }

        // Merge config
        $currentShare = $shares[$shareIndex];

        foreach ($config as $key => $value) {
            if ($value !== null && array_key_exists($key, $currentShare)) {
                $currentShare[$key] = $value;
            }
        }

        // Rebuild entire config
        return $this->writeSharesConfig($shares);
    }

    /**
     * Delete a share.
     *
     * @return bool
     * @throws \RuntimeException
     */
    public function deleteShare(string $name): bool
    {
        $shares = $this->getShares();
        $shareIndex = null;

        foreach ($shares as $index => $share) {
            if ($share['name'] === $name) {
                $shareIndex = $index;
                break;
            }
        }

        if ($shareIndex === null) {
            throw new \RuntimeException("Share '{$name}' not found");
        }

        // Cannot delete system shares
        if ($shares[$shareIndex]['type'] === 'system') {
            throw new \RuntimeException('Cannot delete system shares');
        }

        // Cannot delete homes share
        if ($shares[$shareIndex]['type'] === 'homes') {
            throw new \RuntimeException('Cannot delete homes share. Use browseable = no to disable.');
        }

        // Remove share
        unset($shares[$shareIndex]);

        return $this->writeSharesConfig(array_values($shares));
    }

    /**
     * Enable or disable the homes share.
     * When enabling: adds the [homes] section
     * When disabling: removes the [homes] section entirely
     */
    public function setHomesEnabled(bool $enabled): bool
    {
        \Illuminate\Support\Facades\Log::info('[SambaService] setHomesEnabled called with enabled: ' . ($enabled ? 'true' : 'false'));

        $shares = $this->getShares();
        \Illuminate\Support\Facades\Log::info('[SambaService] Current shares count: ' . count($shares));

        $homesIndex = null;

        foreach ($shares as $index => $share) {
            if ($share['name'] === 'homes') {
                $homesIndex = $index;
                \Illuminate\Support\Facades\Log::info('[SambaService] Found homes share at index: ' . $index);
                break;
            }
        }

        if ($enabled) {
            \Illuminate\Support\Facades\Log::info('[SambaService] Enabling homes share');
            // Enable: Add [homes] section if it doesn't exist in config
            // Check if homes is in the actual config file, not just in the shares array
            // (getShares() always adds homes with enabled:false when not in config)
            $shares = $this->getShares();
            $homesInConfig = false;

            // Check if homes actually exists in the config file by reading it directly
            $configContent = file_get_contents(self::SMBCONF_PATH);
            if ($configContent !== false && strpos($configContent, '[homes]') !== false) {
                $homesInConfig = true;
            }

            if (!$homesInConfig) {
                // Add homes to the shares array
                $shares[] = [
                    'name' => 'homes',
                    'type' => 'homes',
                    'comment' => 'Home Directories',
                    'enabled' => true,
                ];
                \Illuminate\Support\Facades\Log::info('[SambaService] Adding homes to shares array and writing config');
                return $this->writeSharesConfig($shares);
            }

            // Homes exists in config but might be disabled in our tracking
            // Update the homes entry and write to ensure it's enabled
            foreach ($shares as &$share) {
                if ($share['name'] === 'homes') {
                    $share['enabled'] = true;
                    \Illuminate\Support\Facades\Log::info('[SambaService] Updating homes enabled status and writing config');
                    return $this->writeSharesConfig($shares);
                }
            }

            \Illuminate\Support\Facades\Log::info('[SambaService] Homes already enabled, returning true');
            return true;
        }

        \Illuminate\Support\Facades\Log::info('[SambaService] Disabling homes share');
        // Disable: Remove [homes] section entirely
        if ($homesIndex !== null) {
            \Illuminate\Support\Facades\Log::info('[SambaService] Unsetting homes at index: ' . $homesIndex);
            unset($shares[$homesIndex]);
            \Illuminate\Support\Facades\Log::info('[SambaService] Shares count after unset: ' . count($shares));
            \Illuminate\Support\Facades\Log::info('[SambaService] Calling writeSharesConfig');
            return $this->writeSharesConfig(array_values($shares));
        }

        \Illuminate\Support\Facades\Log::info('[SambaService] Homes not found, nothing to do');
        return true;
    }

    /**
     * Build share configuration string.
     *
     * @param array{comment?: string, path?: string, writable?: string, guest?: string, 'valid users'?: string} $config
     */
    protected function buildShareConfig(array $config): string
    {
        $lines = [];

        if (!empty($config['comment'])) {
            $lines[] = "   comment = {$config['comment']}";
        }

        if (!empty($config['path'])) {
            $lines[] = "   path = {$config['path']}";
        }

        if (!empty($config['writable'])) {
            $lines[] = "   writable = {$config['writable']}";
        }

        if (!empty($config['guest'])) {
            $lines[] = "   guest = {$config['guest']}";
        }

        if (!empty($config['valid users'])) {
            $lines[] = "   valid users = {$config['valid users']}";
        }

        // Default values (hidden from UI)
        if (empty($config['create mask'])) {
            $lines[] = '   create mask = 0664';
        }

        if (empty($config['directory mask'])) {
            $lines[] = '   directory mask = 0775';
        }

        return implode("\n", $lines) . "\n";
    }

    /**
     * Write all shares to smb.conf.
     * Preserves the entire [global] section and all other sections.
     *
     * @param array<int, array{name: string, type: string, comment?: ?string, path?: ?string, writable?: ?string, guest?: ?string, 'valid users'?: ?string, 'create mask'?: ?string, 'directory mask'?: ?string, browseable?: ?string, 'read only'?: ?string, enabled?: bool}> $shares
     * @return bool
     * @throws \RuntimeException
     */
    protected function writeSharesConfig(array $shares): bool
    {
        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Called with ' . count($shares) . ' shares');

        // Read existing config
        $existingContent = file_get_contents(self::SMBCONF_PATH);
        if ($existingContent === false) {
            throw new \RuntimeException('Unable to read smb.conf');
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Existing config size: ' . strlen($existingContent));

        // Parse the existing config into sections
        $sections = [];
        $currentSection = null;
        $lines = preg_split('/\r?\n/', $existingContent);

        foreach ($lines as $line) {
            $trimmed = trim($line);

            if (empty($trimmed)) {
                continue;
            }

            if (preg_match('/^\[([^\]]+)\]$/', $trimmed, $matches)) {
                $currentSection = $matches[1];
                $sections[$currentSection] = [];
                continue;
            }

            if ($currentSection !== null) {
                $sections[$currentSection][] = $line;
            }
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Parsed sections: ' . implode(', ', array_keys($sections)));

        // Update or add share sections
        foreach ($shares as $share) {
            $shareName = $share['name'];
            \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Processing share: ' . $shareName . ' (type: ' . $share['type'] . ')');
            $shareConfig = [];

            // Add configured options
            if (!empty($share['comment'])) {
                $shareConfig[] = "   comment = {$share['comment']}";
            }

            if (!empty($share['path']) && $share['type'] !== 'homes') {
                $shareConfig[] = "   path = {$share['path']}";
            }

            if (!empty($share['writable']) && $share['type'] !== 'homes') {
                $shareConfig[] = "   writable = {$share['writable']}";
            }

            if (!empty($share['guest']) && $share['type'] !== 'homes') {
                $shareConfig[] = "   guest = {$share['guest']}";
            }

            if (!empty($share['valid users'])) {
                $shareConfig[] = "   valid users = {$share['valid users']}";
            }

            // Create/directory masks for custom shares only
            if ($share['type'] === 'custom') {
                $shareConfig[] = '   create mask = 0664';
                $shareConfig[] = '   directory mask = 0775';
            }

            // Homes share options - add valid users and browseable always, add default comment only if not provided
            if ($share['type'] === 'homes') {
                if (empty($share['comment'])) {
                    $shareConfig[] = '   comment = Home Directories';
                }
                if (empty($share['valid users'])) {
                    $shareConfig[] = '   valid users = %S';
                }
                // Homes should not be browsable by default (security)
                if (empty($share['browseable'])) {
                    $shareConfig[] = '   browseable = no';
                }
            }

            $sections[$shareName] = $shareConfig;
        }

        // Remove sections that are not in the shares array (they were removed or disabled)
        // This ensures that when a share is removed from $shares, it's also removed from config
        $shareNames = array_column($shares, 'name');
        foreach (array_keys($sections) as $sectionName) {
            // Skip global - it's handled separately
            if ($sectionName === 'global') {
                continue;
            }
            // Remove sections not in the shares array
            if (!in_array($sectionName, $shareNames, true)) {
                unset($sections[$sectionName]);
            }
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Sections after cleanup: ' . implode(', ', array_keys($sections)));

        // Reconstruct the config file
        $output = '';

        // First output the global section if it exists (preserve original)
        if (isset($sections['global'])) {
            $output .= "[global]\n" . implode("\n", $sections['global']) . "\n\n";
            unset($sections['global']);
        }

        // Then output all other sections (including shares)
        foreach ($sections as $sectionName => $sectionLines) {
            $output .= "[{$sectionName}]\n";
            if (!empty($sectionLines)) {
                $output .= implode("\n", $sectionLines) . "\n";
            }
            $output .= "\n";
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Output size: ' . strlen($output));

        // Write to temp file
        $tempFile = '/tmp/smb.conf.' . uniqid();
        if (file_put_contents($tempFile, $output) === false) {
            throw new \RuntimeException('Unable to write temporary config');
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] Written to temp file: ' . $tempFile);

        // Validate
        $process = new Process(['sudo', 'testparm', '-s', $tempFile]);
        $process->run();

        if (!$process->isSuccessful()) {
            unlink($tempFile);
            \Illuminate\Support\Facades\Log::error('[writeSharesConfig] testparm failed: ' . $process->getErrorOutput());
            throw new \RuntimeException('Invalid smb.conf: ' . $process->getErrorOutput());
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] testparm passed');

        // Move to actual location
        $process = new Process(['sudo', 'mv', $tempFile, self::SMBCONF_PATH]);
        $process->run();

        if (!$process->isSuccessful()) {
            \Illuminate\Support\Facades\Log::error('[writeSharesConfig] mv failed: ' . $process->getErrorOutput());
            throw new \RuntimeException('Failed to update smb.conf: ' . $process->getErrorOutput());
        }

        \Illuminate\Support\Facades\Log::info('[writeSharesConfig] File moved successfully');

        return $this->restartSmb();
    }

    /**
     * Restart Samba services.
     */
    public function restartSmb(): bool
    {
        // Try to restart smbd first, then nmbd
        $process = new Process(['sudo', 'systemctl', 'restart', 'smbd']);
        $process->run();

        if (!$process->isSuccessful()) {
            // Try alternative service names
            $process = new Process(['sudo', 'service', 'smbd', 'restart']);
            $process->run();

            if (!$process->isSuccessful()) {
                // Try smbd directly
                $process = new Process(['sudo', 'smbd', '--reload-config']);
                $process->run();
            }
        }

        // Also restart nmbd if it exists
        $process = new Process(['sudo', 'systemctl', 'restart', 'nmbd']);
        $process->run();

        return true;
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
     */
    protected function cleanupTempFile(string $tempFile): void
    {
        $process = new Process(['sudo', 'rm', '-f', $tempFile]);
        $process->run();
    }
}
