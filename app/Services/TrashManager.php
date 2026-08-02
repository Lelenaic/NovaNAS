<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\TrashedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class TrashManager
{
    private const TRASH_SUBDIR = '.local/share/Trash';

    private const RETENTION_SETTING_KEY = 'filemanager.trash_retention_days';

    private const DEFAULT_RETENTION_DAYS = 30;

    /**
     * Get the trash retention period in days.
     */
    public function getRetentionDays(): int
    {
        $value = Setting::getValue(self::RETENTION_SETTING_KEY);

        if ($value === null || ! is_numeric($value)) {
            return self::DEFAULT_RETENTION_DAYS;
        }

        return max(1, (int) $value);
    }

    /**
     * Set the trash retention period in days.
     */
    public function setRetentionDays(int $days): void
    {
        Setting::setValue(self::RETENTION_SETTING_KEY, (string) max(1, $days));
    }

    /**
     * Get the trash directory path for a user.
     *
     * Follows the freedesktop.org XDG trash spec: ~/.local/share/Trash/
     */
    public function getTrashDir(string $username): string
    {
        $userInfo = posix_getpwnam($username);

        if ($userInfo && ! empty($userInfo['dir'])) {
            return $userInfo['dir'].'/'.self::TRASH_SUBDIR;
        }

        return '/home/'.$username.'/'.self::TRASH_SUBDIR;
    }

    /**
     * Get a unique trash path for a file, avoiding collisions.
     *
     * Per the XDG spec, files go in Trash/files/ and metadata in Trash/info/.
     */
    protected function getUniqueTrashPath(string $trashDir, string $filename): string
    {
        $filesDir = $trashDir.'/files';

        if (! is_dir($filesDir)) {
            Process::run('sudo mkdir -p '.escapeshellarg($filesDir));
        }

        $trashPath = $filesDir.'/'.$filename;

        if (! file_exists($trashPath)) {
            return $trashPath;
        }

        // Append a number to avoid collisions: file (1), file (2), etc.
        $pathInfo = pathinfo($filename);
        $base = $pathInfo['filename'];
        $ext = isset($pathInfo['extension']) ? '.'.$pathInfo['extension'] : '';
        $counter = 1;

        do {
            $trashPath = $filesDir.'/'.$base.' ('.$counter.')'.$ext;
            $counter++;
        } while (file_exists($trashPath));

        return $trashPath;
    }

    /**
     * Write a .trashinfo metadata file per the XDG spec.
     */
    protected function writeTrashInfo(string $trashDir, string $trashFilename, string $originalPath): void
    {
        $infoDir = $trashDir.'/info';

        if (! is_dir($infoDir)) {
            Process::run('sudo mkdir -p '.escapeshellarg($infoDir));
        }

        $infoPath = $infoDir.'/'.$trashFilename.'.trashinfo';
        $deletionDate = gmdate('Y-%m-%dT%H:%M:%S');

        $content = "[Trash Info]\n".
            'Path='.str_replace("\n", '%0A', $originalPath)."\n".
            'DeletionDate='.$deletionDate."\n";

        file_put_contents($infoPath, $content);
    }

    /**
     * Remove a .trashinfo metadata file.
     */
    protected function removeTrashInfo(string $trashDir, string $trashPath): void
    {
        $trashFilename = basename($trashPath);
        $infoPath = $trashDir.'/info/'.$trashFilename.'.trashinfo';

        if (file_exists($infoPath)) {
            Process::run('sudo rm -f '.escapeshellarg($infoPath));
        }
    }

    /**
     * Move a file or directory to trash.
     *
     * Returns the TrashedFile model on success, or null on failure.
     */
    public function trash(string $path, int $userId, string $username): ?TrashedFile
    {
        if (! file_exists($path)) {
            return null;
        }

        $filename = basename($path);
        $trashDir = $this->getTrashDir($username);
        $trashPath = $this->getUniqueTrashPath($trashDir, $filename);

        // Ensure trash directories exist
        Process::run('sudo mkdir -p '.escapeshellarg($trashDir.'/files'));
        Process::run('sudo mkdir -p '.escapeshellarg($trashDir.'/info'));

        // Move the file to trash
        $result = Process::run('sudo mv '.escapeshellarg($path).' '.escapeshellarg($trashPath));

        if (! $result->successful()) {
            Log::error('TrashManager: Failed to move file to trash', [
                'path' => $path,
                'error' => $result->errorOutput(),
            ]);

            return null;
        }

        // Write .trashinfo metadata
        $trashFilename = basename($trashPath);
        $this->writeTrashInfo($trashDir, $trashFilename, $path);

        // Preserve ownership
        Process::run('sudo chown -R '.escapeshellarg($username).':'.escapeshellarg($username).' '.escapeshellarg($trashDir));

        $retentionDays = $this->getRetentionDays();

        return TrashedFile::create([
            'original_path' => $path,
            'trash_path' => $trashPath,
            'filename' => $filename,
            'trashed_by' => $userId,
            'trashed_at' => now(),
            'expires_at' => now()->addDays($retentionDays),
        ]);
    }

    /**
     * Restore a file from trash to its original location.
     */
    public function restore(TrashedFile $trashedFile): bool
    {
        if (! file_exists($trashedFile->trash_path)) {
            Log::warning('TrashManager: File no longer exists in trash', [
                'trash_path' => $trashedFile->trash_path,
            ]);
            $trashedFile->delete();

            return false;
        }

        $originalDir = dirname($trashedFile->original_path);

        // Ensure original parent directory exists
        if (! is_dir($originalDir)) {
            Process::run('sudo mkdir -p '.escapeshellarg($originalDir));
        }

        $result = Process::run('sudo mv '.escapeshellarg($trashedFile->trash_path).' '.escapeshellarg($trashedFile->original_path));

        if (! $result->successful()) {
            Log::error('TrashManager: Failed to restore file from trash', [
                'trash_path' => $trashedFile->trash_path,
                'original_path' => $trashedFile->original_path,
                'error' => $result->errorOutput(),
            ]);

            return false;
        }

        // Remove .trashinfo
        $trashDir = dirname(dirname($trashedFile->trash_path));
        $this->removeTrashInfo($trashDir, $trashedFile->trash_path);

        $trashedFile->delete();

        return true;
    }

    /**
     * Permanently delete a trashed file.
     */
    public function forceDelete(TrashedFile $trashedFile): bool
    {
        if (file_exists($trashedFile->trash_path)) {
            $result = Process::run('sudo rm -rf '.escapeshellarg($trashedFile->trash_path));

            if (! $result->successful()) {
                Log::error('TrashManager: Failed to permanently delete trashed file', [
                    'trash_path' => $trashedFile->trash_path,
                    'error' => $result->errorOutput(),
                ]);

                return false;
            }

            // Remove .trashinfo
            $trashDir = dirname(dirname($trashedFile->trash_path));
            $this->removeTrashInfo($trashDir, $trashedFile->trash_path);
        }

        $trashedFile->delete();

        return true;
    }

    /**
     * Empty the entire trash for a user.
     */
    public function emptyTrash(?int $userId = null): int
    {
        $query = TrashedFile::query();

        if ($userId !== null) {
            $query->forUser($userId);
        }

        $trashedFiles = $query->get();
        $deleted = 0;

        foreach ($trashedFiles as $trashedFile) {
            if ($this->forceDelete($trashedFile)) {
                $deleted++;
            }
        }

        return $deleted;
    }

    /**
     * Delete all expired trashed files (called by the scheduled job).
     */
    public function deleteExpired(): int
    {
        $expired = TrashedFile::expired()->get();
        $deleted = 0;

        foreach ($expired as $trashedFile) {
            if ($this->forceDelete($trashedFile)) {
                $deleted++;
            }
        }

        if ($deleted > 0) {
            Log::info("TrashManager: Auto-deleted {$deleted} expired trashed files");
        }

        return $deleted;
    }
}
