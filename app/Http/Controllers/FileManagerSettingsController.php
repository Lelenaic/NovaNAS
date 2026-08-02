<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

class FileManagerSettingsController extends Controller
{
    private const PHP_INI_PATH = '/etc/php/8.5/apache2/php.ini';

    /**
     * Get file manager settings from php.ini.
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'upload_max_filesize' => $this->getIniValue('upload_max_filesize'),
            'post_max_size' => $this->getIniValue('post_max_size'),
        ]);
    }

    /**
     * Update file manager settings in php.ini and reload Apache.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'upload_max_filesize' => 'required|string',
        ]);

        $value = $validated['upload_max_filesize'];

        if (! $this->isValidSize($value)) {
            return response()->json([
                'message' => 'Invalid size format. Use a value like "2M", "128M", "1G", or "0" for unlimited.',
            ], 422);
        }

        $this->setIniValue('upload_max_filesize', $value);

        // post_max_size should be at least 2x upload_max_filesize to be safe
        $postMaxSize = $this->calculatePostMaxSize($value);
        $this->setIniValue('post_max_size', $postMaxSize);

        $reloadResult = $this->reloadApache();

        if (! $reloadResult['success']) {
            return response()->json([
                'message' => 'Settings saved but Apache reload failed: '.$reloadResult['error'],
            ], 500);
        }

        Log::info('File manager upload settings updated', [
            'upload_max_filesize' => $value,
            'post_max_size' => $postMaxSize,
        ]);

        return response()->json([
            'message' => 'Upload size limit updated successfully.',
            'upload_max_filesize' => $value,
            'post_max_size' => $postMaxSize,
        ]);
    }

    /**
     * Read a value from php.ini using grep.
     */
    protected function getIniValue(string $key): string
    {
        $process = new Process(['grep', '-E', "^{$key}\s*=", self::PHP_INI_PATH]);
        $process->run();

        if (! $process->isSuccessful()) {
            return '';
        }

        $line = trim($process->getOutput());
        $parts = explode('=', $line, 2);

        return isset($parts[1]) ? trim($parts[1]) : '';
    }

    /**
     * Update a value in php.ini using sed.
     */
    protected function setIniValue(string $key, string $value): void
    {
        // Use sed to replace the value
        $process = new Process([
            'sudo', 'sed', '-i',
            "-e s/^\\s*{$key}\\s*=.*/{$key} = {$value}/",
            self::PHP_INI_PATH,
        ]);
        $process->run();

        // Fallback: if sed didn't find the line, append it
        $checkProcess = new Process(['grep', '-cE', "^\\s*{$key}\\s*=", self::PHP_INI_PATH]);
        $checkProcess->run();

        if ($checkProcess->isSuccessful() && trim($checkProcess->getOutput()) === '0') {
            $appendProcess = new Process([
                'sudo', 'bash', '-c',
                'echo '.escapeshellarg("{$key} = {$value}").' >> '.escapeshellarg(self::PHP_INI_PATH),
            ]);
            $appendProcess->run();
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
        $process = new Process(['sudo', 'apache2ctl', 'configtest']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'error' => $process->getErrorOutput(),
            ];
        }

        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'error' => $process->getErrorOutput(),
            ];
        }

        return ['success' => true];
    }
}
