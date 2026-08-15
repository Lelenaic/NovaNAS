<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\TrashedFile;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class TrashManager
{
    public function __construct(
        private LinuxUserService $linuxUserService
    ) {}

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
        return $this->linuxUserService->getHomeDirectory($username).'/'.self::TRASH_SUBDIR;
    }

    /**
     * Ensure the trash directory and its subdirectories exist with correct ownership.
     *
     * Creates ~/.local/share/Trash/, Trash/files/, and Trash/info/ as the given user.
     */
    protected function ensureTrashDirectoriesExist(string $trashDir, string $username): void
    {
        Process::run('sudo -u '.escapeshellarg($username).' mkdir -p '.escapeshellarg($trashDir.'/files'));
        Process::run('sudo -u '.escapeshellarg($username).' mkdir -p '.escapeshellarg($trashDir.'/info'));
    }

    /**
     * Get a unique trash path for a file, avoiding collisions.
     *
     * Per the XDG spec, files go in Trash/files/ and metadata in Trash/info/.
     */
    protected function getUniqueTrashPath(string $trashDir, string $filename): string
    {
        $filesDir = $trashDir.'/files';
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
        $infoPath = $trashDir.'/info/'.$trashFilename.'.trashinfo';
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
     * Parse a .trashinfo metadata file per the XDG spec.
     *
     * Returns ['original_path' => ..., 'deletion_date' => ...] or null on failure.
     */
    public function parseTrashInfo(string $trashDir, string $trashFilename): ?array
    {
        $infoPath = $trashDir.'/info/'.$trashFilename.'.trashinfo';

        if (! is_file($infoPath)) {
            return null;
        }

        $content = file_get_contents($infoPath);

        if ($content === false) {
            return null;
        }

        $originalPath = null;
        $deletionDate = null;

        foreach (explode("\n", $content) as $line) {
            $line = trim($line);
            if (str_starts_with($line, 'Path=')) {
                $originalPath = rawurldecode(substr($line, 5));
            } elseif (str_starts_with($line, 'DeletionDate=')) {
                $deletionDate = substr($line, 13);
            }
        }

        if ($originalPath === null) {
            return null;
        }

        return [
            'original_path' => $originalPath,
            'deletion_date' => $deletionDate,
        ];
    }

    /**
     * List all trashed files for a user by scanning the filesystem and merging with DB records.
     *
     * The filesystem is the source of truth for what exists in trash.
     * The DB supplements with metadata (trashed_by, expires_at) when available.
     */
    public function listTrashFilesForUser(int $userId, string $username): array
    {
        $trashDir = $this->getTrashDir($username);
        $filesDir = $trashDir.'/files';

        if (! is_dir($filesDir)) {
            return [];
        }

        // Scan filesystem for trashed files
        $result = Process::run('ls -1 '.escapeshellarg($filesDir));

        if (! $result->successful() || trim($result->output()) === '') {
            return [];
        }

        $filenames = array_filter(explode("\n", trim($result->output())));

        // Load all DB records for this user, keyed by filename
        $dbRecords = TrashedFile::forUser($userId)
            ->get()
            ->keyBy('filename');

        $items = [];

        foreach ($filenames as $filename) {
            $trashPath = $filesDir.'/'.$filename;

            // Skip if not actually a file/directory (shouldn't happen, but safety check)
            if (! file_exists($trashPath)) {
                continue;
            }

            $isDirectory = is_dir($trashPath);

            // Merge: prefer DB data if available, fall back to .trashinfo
            if (isset($dbRecords[$filename])) {
                $record = $dbRecords[$filename];
                $items[] = [
                    'id' => $record->id,
                    'filename' => $filename,
                    'original_path' => $record->original_path,
                    'trashed_at' => $record->trashed_at->toIso8601String(),
                    'expires_at' => $record->expires_at->toIso8601String(),
                    'is_directory' => $isDirectory,
                    'in_database' => true,
                ];
            } else {
                // File trashed from outside the app — parse .trashinfo
                $info = $this->parseTrashInfo($trashDir, $filename);

                $items[] = [
                    'id' => null,
                    'filename' => $filename,
                    'original_path' => $info['original_path'] ?? 'Unknown',
                    'trashed_at' => $info['deletion_date'] ?? null,
                    'expires_at' => null,
                    'is_directory' => $isDirectory,
                    'in_database' => false,
                ];
            }
        }

        // Sort by trashed_at descending (newest first), items without date at the end
        usort($items, function ($a, $b) {
            if ($a['trashed_at'] === null) {
                return 1;
            }
            if ($b['trashed_at'] === null) {
                return -1;
            }

            return strcmp($b['trashed_at'], $a['trashed_at']);
        });

        return $items;
    }

    /**
     * Find a trash item by filename for a user.
     *
     * Returns an array with item data, or null if not found.
     */
    public function getTrashItem(string $filename, int $userId, string $username): ?array
    {
        $trashDir = $this->getTrashDir($username);
        $trashPath = $trashDir.'/files/'.$filename;

        if (! file_exists($trashPath)) {
            return null;
        }

        $isDirectory = is_dir($trashPath);

        // Check DB first
        $record = TrashedFile::where('filename', $filename)
            ->where('trashed_by', $userId)
            ->first();

        if ($record) {
            return [
                'id' => $record->id,
                'filename' => $filename,
                'original_path' => $record->original_path,
                'trash_path' => $record->trash_path,
                'trashed_at' => $record->trashed_at->toIso8601String(),
                'expires_at' => $record->expires_at->toIso8601String(),
                'is_directory' => $isDirectory,
                'in_database' => true,
                'model' => $record,
            ];
        }

        // Fall back to .trashinfo
        $info = $this->parseTrashInfo($trashDir, $filename);

        return [
            'id' => null,
            'filename' => $filename,
            'original_path' => $info['original_path'] ?? null,
            'trash_path' => $trashPath,
            'trashed_at' => $info['deletion_date'] ?? null,
            'expires_at' => null,
            'is_directory' => $isDirectory,
            'in_database' => false,
            'model' => null,
        ];
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

        $this->ensureTrashDirectoriesExist($trashDir, $username);

        $trashPath = $this->getUniqueTrashPath($trashDir, $filename);

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
     *
     * Accepts a filename and user ID. Works for both DB-tracked and filesystem-only items.
     */
    public function restore(string $filename, int $userId): bool
    {
        $item = $this->getTrashItem($filename, $userId, $this->getUsernameForUser($userId));

        if ($item === null) {
            Log::warning('TrashManager: File not found in trash', ['filename' => $filename]);

            return false;
        }

        $trashPath = $item['trash_path'];
        $originalPath = $item['original_path'];

        if ($originalPath === null) {
            Log::warning('TrashManager: Cannot restore — original path unknown', ['filename' => $filename]);

            return false;
        }

        $originalDir = dirname($originalPath);

        // Ensure original parent directory exists
        if (! is_dir($originalDir)) {
            Process::run('sudo mkdir -p '.escapeshellarg($originalDir));
        }

        $result = Process::run('sudo mv '.escapeshellarg($trashPath).' '.escapeshellarg($originalPath));

        if (! $result->successful()) {
            Log::error('TrashManager: Failed to restore file from trash', [
                'trash_path' => $trashPath,
                'original_path' => $originalPath,
                'error' => $result->errorOutput(),
            ]);

            return false;
        }

        // Remove .trashinfo
        $trashDir = dirname(dirname($trashPath));
        $this->removeTrashInfo($trashDir, $trashPath);

        // Remove DB record if it exists
        if ($item['model'] !== null) {
            $item['model']->delete();
        }

        return true;
    }

    /**
     * Permanently delete a trashed file.
     *
     * Accepts a filename and user ID. Works for both DB-tracked and filesystem-only items.
     */
    public function forceDelete(string $filename, int $userId): bool
    {
        $item = $this->getTrashItem($filename, $userId, $this->getUsernameForUser($userId));

        if ($item === null) {
            return false;
        }

        $trashPath = $item['trash_path'];

        if (file_exists($trashPath)) {
            $result = Process::run('sudo rm -rf '.escapeshellarg($trashPath));

            if (! $result->successful()) {
                Log::error('TrashManager: Failed to permanently delete trashed file', [
                    'trash_path' => $trashPath,
                    'error' => $result->errorOutput(),
                ]);

                return false;
            }

            // Remove .trashinfo
            $trashDir = dirname(dirname($trashPath));
            $this->removeTrashInfo($trashDir, $trashPath);
        }

        // Remove DB record if it exists
        if ($item['model'] !== null) {
            $item['model']->delete();
        }

        return true;
    }

    /**
     * Empty the entire trash for a user.
     *
     * Deletes all files in Trash/files/ and all DB records for the user.
     */
    public function emptyTrash(int $userId): int
    {
        $username = $this->getUsernameForUser($userId);
        $trashDir = $this->getTrashDir($username);
        $filesDir = $trashDir.'/files';
        $infoDir = $trashDir.'/info';

        $deleted = 0;

        // Delete all files in Trash/files/
        if (is_dir($filesDir)) {
            $result = Process::run('ls -1 '.escapeshellarg($filesDir));

            if ($result->successful() && trim($result->output()) !== '') {
                $filenames = array_filter(explode("\n", trim($result->output())));

                foreach ($filenames as $filename) {
                    $trashPath = $filesDir.'/'.$filename;
                    if (file_exists($trashPath)) {
                        Process::run('sudo rm -rf '.escapeshellarg($trashPath));
                        $deleted++;
                    }

                    // Remove corresponding .trashinfo
                    $this->removeTrashInfo($trashDir, $trashPath);
                }
            }
        }

        // Remove all DB records for this user
        TrashedFile::forUser($userId)->delete();

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
            // Delete from filesystem if it still exists
            if (file_exists($trashedFile->trash_path)) {
                $result = Process::run('sudo rm -rf '.escapeshellarg($trashedFile->trash_path));

                if ($result->successful()) {
                    $trashDir = dirname(dirname($trashedFile->trash_path));
                    $this->removeTrashInfo($trashDir, $trashedFile->trash_path);
                    $deleted++;
                } else {
                    Log::error('TrashManager: Failed to auto-delete expired file', [
                        'trash_path' => $trashedFile->trash_path,
                        'error' => $result->errorOutput(),
                    ]);
                }
            }

            // Always delete the DB record (even if file was already gone)
            $trashedFile->delete();
        }

        if ($deleted > 0) {
            Log::info("TrashManager: Auto-deleted {$deleted} expired trashed files");
        }

        return $deleted;
    }

    /**
     * Get the Linux username for a given user ID.
     */
    private function getUsernameForUser(int $userId): string
    {
        $user = User::findOrFail($userId);

        return $user->username;
    }
}
