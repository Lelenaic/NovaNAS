<?php

namespace App\Services\Backup;

use App\Models\Setting;
use App\Services\SystemInfoService;
use Illuminate\Support\Facades\Process;

/**
 * Service for managing the NovaNAS backup server (restic rest-server).
 *
 * Manages the htpasswd file, systemd service, and backup path configuration.
 * All paths are resolved via base_path() — never hardcoded.
 */
class BackupServerService
{
    public const HTPASSWD_FILENAME = 'backup.htpasswd';

    public const ENV_FILENAME = 'backup-server.env';

    public const DEFAULT_BACKUP_SUBPATH = 'storage/backups';

    public const SETTING_KEY_PATH = 'backup.server_path';

    public function __construct(
        protected SystemInfoService $systemInfoService,
    ) {}

    /**
     * Get the htpasswd file path.
     */
    public function getHtpasswdPath(): string
    {
        return base_path(self::HTPASSWD_FILENAME);
    }

    /**
     * Get the env file path.
     */
    public function getEnvFilePath(): string
    {
        return base_path(self::ENV_FILENAME);
    }

    /**
     * Get the default backup path.
     */
    public function getDefaultBackupPath(): string
    {
        return base_path(self::DEFAULT_BACKUP_SUBPATH);
    }

    /**
     * Get the configured backup path.
     */
    public function getBackupPath(): string
    {
        return Setting::getValue(self::SETTING_KEY_PATH) ?? $this->getDefaultBackupPath();
    }

    /**
     * Update the backup path.
     */
    public function setBackupPath(string $path): void
    {
        $path = rtrim($path, '/');

        $result = Process::run(['sudo', 'mkdir', '-p', $path]);
        if ($result->failed()) {
            throw new \RuntimeException("Failed to create backup directory: {$result->errorOutput()}");
        }

        $result = Process::run(['sudo', 'chown', 'novanas:novanas', $path]);
        if ($result->failed()) {
            throw new \RuntimeException("Failed to set directory ownership: {$result->errorOutput()}");
        }

        Setting::setValue(self::SETTING_KEY_PATH, $path);

        $this->writeEnvFile($path);
        $this->daemonReload();
    }

    /**
     * List all API keys (htpasswd entries).
     *
     * @return list<array{name: string}>
     */
    public function listApiKeys(): array
    {
        $keys = [];
        $lines = $this->readHtpasswdFile();

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            $colonPos = strpos($line, ':');
            if ($colonPos !== false) {
                $keys[] = ['name' => substr($line, 0, $colonPos)];
            }
        }

        return $keys;
    }

    /**
     * Get the number of API keys.
     */
    public function getApiKeyCount(): int
    {
        return count($this->listApiKeys());
    }

    /**
     * Create a new API key.
     *
     * @return array{name: string, key: string}
     */
    public function addApiKey(string $name): array
    {
        if ($this->apiKeyExists($name)) {
            throw new \InvalidArgumentException("An API key with the name '{$name}' already exists.");
        }

        $password = bin2hex(random_bytes(127));

        $result = Process::run([
            'sudo', 'htpasswd', '-B', '-b',
            $this->getHtpasswdPath(),
            $name,
            $password,
        ]);

        if ($result->failed()) {
            throw new \RuntimeException("Failed to create API key: {$result->errorOutput()}");
        }

        $plainKey = $name.':'.$password;

        return [
            'name' => $name,
            'key' => base64_encode($plainKey),
        ];
    }

    /**
     * Delete an API key.
     */
    public function deleteApiKey(string $name): bool
    {
        if (! $this->apiKeyExists($name)) {
            return false;
        }

        $result = Process::run([
            'sudo', 'htpasswd', '-D',
            $this->getHtpasswdPath(),
            $name,
        ]);

        if ($result->failed()) {
            throw new \RuntimeException("Failed to delete API key: {$result->errorOutput()}");
        }

        if ($this->getApiKeyCount() === 0) {
            $this->disableService();
        }

        return true;
    }

    /**
     * Check if an API key with the given name exists.
     */
    public function apiKeyExists(string $name): bool
    {
        foreach ($this->listApiKeys() as $key) {
            if ($key['name'] === $name) {
                return true;
            }
        }

        return false;
    }

    /**
     * Enable and start the backup server service.
     */
    public function enableService(): void
    {
        $result = Process::run(['sudo', 'a2enconf', 'novanas-backup-server']);
        if ($result->failed()) {
            throw new \RuntimeException('Failed to enable Apache config: '.$result->errorOutput());
        }

        $result = Process::run(['sudo', 'systemctl', 'enable', '--now', 'novanas-backup-server']);
        if ($result->failed()) {
            throw new \RuntimeException('Failed to enable backup server: '.$result->errorOutput());
        }

        Process::run(['sudo', 'systemctl', 'reload', 'apache2']);
    }

    /**
     * Disable and stop the backup server service.
     */
    public function disableService(): void
    {
        $result = Process::run(['sudo', 'systemctl', 'disable', '--now', 'novanas-backup-server']);
        if ($result->failed()) {
            throw new \RuntimeException('Failed to disable backup server: '.$result->errorOutput());
        }

        $result = Process::run(['sudo', 'a2disconf', 'novanas-backup-server']);
        if ($result->failed()) {
            throw new \RuntimeException('Failed to disable Apache config: '.$result->errorOutput());
        }

        Process::run(['sudo', 'systemctl', 'reload', 'apache2']);
    }

    /**
     * Check if the service is enabled (will start on boot).
     */
    public function isServiceEnabled(): bool
    {
        $result = Process::run(['sudo', 'systemctl', 'is-enabled', 'novanas-backup-server']);

        return $result->successful() && trim($result->output()) === 'enabled';
    }

    /**
     * Check if the service is currently active (running).
     */
    public function isServiceActive(): bool
    {
        $result = Process::run(['sudo', 'systemctl', 'is-active', 'novanas-backup-server']);

        return $result->successful() && trim($result->output()) === 'active';
    }

    /**
     * Get the machine-id for this server.
     */
    public function getMachineId(): string
    {
        return $this->systemInfoService->getNasUuid();
    }

    /**
     * Read the htpasswd file contents.
     *
     * @return list<string>
     */
    protected function readHtpasswdFile(): array
    {
        $result = Process::run(['sudo', 'cat', $this->getHtpasswdPath()]);
        if ($result->failed()) {
            return [];
        }

        return explode("\n", $result->output());
    }

    /**
     * Write the systemd environment file with the backup path.
     */
    protected function writeEnvFile(string $backupPath): void
    {
        $content = "BACKUP_PATH={$backupPath}\n";
        $escapedContent = escapeshellarg($content);
        $escapedPath = escapeshellarg($this->getEnvFilePath());

        Process::run("echo {$escapedContent} | sudo tee {$escapedPath} > /dev/null 2>&1");
    }

    /**
     * Reload the systemd daemon.
     */
    protected function daemonReload(): void
    {
        Process::run(['sudo', 'systemctl', 'daemon-reload']);
    }
}
