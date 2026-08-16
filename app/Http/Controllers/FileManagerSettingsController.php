<?php

namespace App\Http\Controllers;

use App\Services\TrashManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class FileManagerSettingsController extends Controller
{
    private const PHP_INI_PATH = '/etc/php/8.5/apache2/php.ini';

    public function __construct(
        protected TrashManager $trashManager
    ) {}

    /**
     * Get file manager settings.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'upload_max_filesize' => $this->getIniValue('upload_max_filesize'),
            'post_max_size' => $this->getIniValue('post_max_size'),
            'trash_retention_days' => $this->trashManager->getRetentionDays(),
        ]);
    }

    /**
     * Update file manager settings.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_max_filesize' => 'required_without:trash_retention_days|nullable|string',
            'trash_retention_days' => 'required_without:upload_max_filesize|nullable|integer|min:1|max:365',
        ]);

        $message = 'Settings updated successfully.';

        // Update upload size if provided
        if (! empty($validated['upload_max_filesize'])) {
            $value = $validated['upload_max_filesize'];

            if (! $this->isValidSize($value)) {
                return response()->json([
                    'message' => 'Invalid size format. Use a value like "2M", "128M", "1G", or "0" for unlimited.',
                ], 422);
            }

            $this->setIniValue('upload_max_filesize', $value);

            $postMaxSize = $this->calculatePostMaxSize($value);
            $this->setIniValue('post_max_size', $postMaxSize);

            $reloadResult = $this->reloadApache();

            if (! $reloadResult['success']) {
                return response()->json([
                    'message' => 'Upload settings saved but Apache reload failed: '.$reloadResult['error'],
                ], 500);
            }

            Log::info('File manager upload settings updated', [
                'upload_max_filesize' => $value,
                'post_max_size' => $postMaxSize,
            ]);
        }

        // Update trash retention if provided
        if (isset($validated['trash_retention_days'])) {
            $this->trashManager->setRetentionDays((int) $validated['trash_retention_days']);
        }

        return response()->json([
            'message' => $message,
            'upload_max_filesize' => $this->getIniValue('upload_max_filesize'),
            'post_max_size' => $this->getIniValue('post_max_size'),
            'trash_retention_days' => $this->trashManager->getRetentionDays(),
        ]);
    }

    /**
     * Read a value from php.ini using grep.
     */
    protected function getIniValue(string $key): string
    {
        $result = Process::run(['grep', '-E', "^{$key}\s*=", self::PHP_INI_PATH]);

        if ($result->failed()) {
            return '';
        }

        $line = trim($result->output());
        $parts = explode('=', $line, 2);

        return isset($parts[1]) ? trim($parts[1]) : '';
    }

    /**
     * Update a value in php.ini using sed.
     */
    protected function setIniValue(string $key, string $value): void
    {
        // Use sed to replace the value
        Process::run([
            'sudo', 'sed', '-i',
            "-e s/^\\s*{$key}\\s*=.*/{$key} = {$value}/",
            self::PHP_INI_PATH,
        ]);

        // Fallback: if sed didn't find the line, append it
        $checkResult = Process::run(['grep', '-cE', "^\\s*{$key}\\s*=", self::PHP_INI_PATH]);

        if ($checkResult->successful() && trim($checkResult->output()) === '0') {
            Process::run([
                'sudo', 'bash', '-c',
                'echo '.escapeshellarg("{$key} = {$value}").' >> '.escapeshellarg(self::PHP_INI_PATH),
            ]);
        }
    }

    /**
     * Calculate an appropriate post_max_size based on upload_max_filesize.
     */
    protected function calculatePostMaxSize(string $uploadSize): string
    {
        $numeric = (int) preg_replace('/[^0-9]/', '', $uploadSize);
        $unit = preg_replace('/[0-9]/', '', $uploadSize);

        if ($numeric <= 0) {
            return '0';
        }

        // Double the upload size for post_max_size
        $doubled = $numeric * 2;

        return $doubled.$unit;
    }

    /**
     * Validate a php.ini size value.
     */
    protected function isValidSize(string $value): bool
    {
        // Allow "0" for unlimited
        if ($value === '0') {
            return true;
        }

        // Match patterns like "2M", "128M", "1G", "1024K"
        return (bool) preg_match('/^\d+[KMG]?$/i', $value);
    }

    /**
     * Test Apache config and reload.
     */
    protected function reloadApache(): array
    {
        $result = Process::run(['sudo', 'apache2ctl', 'configtest']);

        if ($result->failed()) {
            return [
                'success' => false,
                'error' => $result->errorOutput(),
            ];
        }

        $result = Process::run(['sudo', 'systemctl', 'reload', 'apache2']);

        if ($result->failed()) {
            return [
                'success' => false,
                'error' => $result->errorOutput(),
            ];
        }

        return ['success' => true];
    }
}
