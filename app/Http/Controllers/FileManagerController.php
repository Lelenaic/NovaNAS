<?php

namespace App\Http\Controllers;

use App\Models\TrashedFile;
use App\Models\User;
use App\Services\AclService;
use App\Services\SambaService;
use App\Services\TrashManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Process;

class FileManagerController extends Controller
{
    public function __construct(
        protected SambaService $sambaService,
        protected AclService $aclService,
        protected TrashManager $trashManager
    ) {}

    /**
     * Get the current user's file manager layout preference.
     */
    public function getLayout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'layout' => $user->file_manager_layout ?? 'list',
        ]);
    }

    /**
     * Update the current user's file manager layout preference.
     */
    public function updateLayout(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'layout' => 'required|in:list,grid',
        ]);

        $user->update(['file_manager_layout' => $validated['layout']]);

        return response()->json([
            'layout' => $validated['layout'],
        ]);
    }

    /**
     * Get the current user's hidden files preference.
     */
    public function getHiddenFiles(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'show_hidden_files' => $user->show_hidden_files ?? false,
        ]);
    }

    /**
     * Update the current user's hidden files preference.
     */
    public function updateHiddenFiles(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'show_hidden_files' => 'required|boolean',
        ]);

        $user->update(['show_hidden_files' => $validated['show_hidden_files']]);

        return response()->json([
            'show_hidden_files' => $validated['show_hidden_files'],
        ]);
    }

    /**
     * Get shares accessible to the current user.
     *
     * Admin users see all shares. Non-admin users see only shares
     * where they have permissions, plus their home directory if enabled.
     */
    public function shares(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $allShares = $this->sambaService->getShares();
        $accessibleShares = [];

        foreach ($allShares as $share) {
            // Skip system shares (printers, etc.)
            if ($share['type'] === 'system') {
                continue;
            }

            // Handle homes share
            if ($share['name'] === 'homes') {
                if ($share['enabled']) {
                    $homePath = $this->getUserHomeDirectory($username);
                    $accessibleShares[] = [
                        'name' => 'Home',
                        'path' => $homePath,
                        'type' => 'home',
                        'permission' => 'readwrite',
                        'enabled' => true,
                    ];
                }

                continue;
            }

            // Custom shares
            if ($share['type'] === 'custom') {
                if ($isAdmin) {
                    // Admin sees all custom shares with their permissions
                    $permission = $this->getUserSharePermission($share, $username);
                    $accessibleShares[] = [
                        'name' => $share['name'],
                        'path' => $share['path'],
                        'type' => 'share',
                        'permission' => $permission ?? 'readwrite',
                        'enabled' => true,
                    ];
                } else {
                    // Non-admin: only shares where this user has permissions
                    $permission = $this->getUserSharePermission($share, $username);
                    if ($permission !== null) {
                        $accessibleShares[] = [
                            'name' => $share['name'],
                            'path' => $share['path'],
                            'type' => 'share',
                            'permission' => $permission,
                            'enabled' => true,
                        ];
                    }
                }
            }
        }

        return response()->json([
            'shares' => $accessibleShares,
        ]);
    }

    /**
     * List files and directories at the given path.
     *
     * Validates that the path is within an accessible share for the user.
     */
    public function files(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $path = $request->input('path');

        if (empty($path)) {
            return response()->json(['error' => 'Path is required'], 422);
        }

        // Resolve the path (handle ~ for home directory)
        if (str_starts_with($path, '~')) {
            $path = $this->getUserHomeDirectory($username).ltrim($path, '~');
        }

        // Normalize path (remove trailing slash except root)
        $path = rtrim($path, '/') ?: '/';

        // Validate the path is accessible to this user
        if (! $this->isPathAccessible($path, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to this path'], 403);
        }

        if (! is_dir($path)) {
            return response()->json(['error' => 'Path is not a directory'], 400);
        }

        $items = [];
        $handle = opendir($path);

        if (! $handle) {
            return response()->json(['error' => 'Cannot open directory'], 500);
        }

        while (($entry = readdir($handle)) !== false) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }

            $fullPath = $path === '/' ? '/'.$entry : $path.'/'.$entry;
            $isDirectory = is_dir($fullPath);

            $item = [
                'name' => $entry,
                'path' => $fullPath,
                'type' => $isDirectory ? 'directory' : 'file',
            ];

            if (! $isDirectory && is_file($fullPath)) {
                $item['size'] = filesize($fullPath);
                $item['modified'] = date('Y-m-d H:i:s', filemtime($fullPath));
            }

            $items[] = $item;
        }

        closedir($handle);

        // Sort: directories first, then by name
        usort($items, function ($a, $b) {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'directory' ? -1 : 1;
            }

            return strcasecmp($a['name'], $b['name']);
        });

        // Build breadcrumb data
        $pathParts = array_filter(explode('/', $path));
        $breadcrumbs = [['name' => 'Home', 'path' => '/']];
        $cumulative = '';
        foreach ($pathParts as $part) {
            $cumulative .= '/'.$part;
            $breadcrumbs[] = ['name' => $part, 'path' => $cumulative];
        }

        return response()->json([
            'items' => $items,
            'path' => $path,
            'breadcrumbs' => $breadcrumbs,
        ]);
    }

    /**
     * Create a new directory.
     */
    public function createDirectory(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'path' => 'required|string',
            'name' => 'required|string|max:255',
        ]);

        $parentPath = rtrim($validated['path'], '/') ?: '/';
        $dirName = $validated['name'];
        $newPath = $parentPath === '/' ? '/'.$dirName : $parentPath.'/'.$dirName;

        // Validate the parent path is accessible
        if (! $this->isPathAccessible($parentPath, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to this path'], 403);
        }

        // Validate the new path is still within an accessible share
        if (! $this->isPathAccessible($newPath, $username, $isAdmin)) {
            return response()->json(['error' => 'Cannot create directory outside accessible shares'], 403);
        }

        if (is_dir($newPath)) {
            return response()->json(['error' => 'Directory already exists'], 409);
        }

        // Validate directory name follows Linux naming rules
        if (str_contains($dirName, '/') || $dirName === '.' || $dirName === '..' || $dirName === '' || preg_match('/[\x00]/', $dirName)) {
            return response()->json(['error' => 'Invalid directory name'], 400);
        }

        $result = \Illuminate\Support\Facades\Process::run('sudo mkdir -p '.escapeshellarg($newPath));

        if (! $result->successful()) {
            return response()->json(['error' => 'Failed to create directory: '.$result->errorOutput()], 500);
        }

        return response()->json([
            'message' => 'Directory created successfully',
            'path' => $newPath,
        ]);
    }

    /**
     * Delete files and folders (moves to trash).
     */
    public function delete(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'paths' => 'required|array|min:1',
            'paths.*' => 'string',
        ]);

        $trashed = 0;

        foreach ($validated['paths'] as $path) {
            if (! $this->isPathAccessible($path, $username, $isAdmin)) {
                return response()->json(['error' => "Access denied to: {$path}"], 403);
            }

            if (! file_exists($path)) {
                continue;
            }

            // Safety: don't allow trashing share roots
            if ($this->isShareRoot($path, $username)) {
                return response()->json(['error' => 'Cannot delete share root directory'], 403);
            }

            $result = $this->trashManager->trash($path, $user->id, $username);
            if ($result) {
                $trashed++;
            }
        }

        return response()->json(['message' => "{$trashed} item(s) moved to trash"]);
    }

    /**
     * List trashed files for the current user.
     */
    public function getTrash(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $trashedFiles = TrashedFile::forUser($user->id)
            ->orderByDesc('trashed_at')
            ->get()
            ->map(fn (TrashedFile $file) => [
                'id' => $file->id,
                'filename' => $file->filename,
                'original_path' => $file->original_path,
                'trashed_at' => $file->trashed_at->toIso8601String(),
                'expires_at' => $file->expires_at->toIso8601String(),
                'is_directory' => is_dir($file->trash_path),
            ]);

        return response()->json([
            'items' => $trashedFiles,
            'retention_days' => $this->trashManager->getRetentionDays(),
        ]);
    }

    /**
     * Restore a file from trash to its original location.
     */
    public function restore(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'id' => 'required|integer|exists:trashed_files,id',
        ]);

        $trashedFile = TrashedFile::findOrFail($validated['id']);

        // Only allow restoring own files (or admin can restore any)
        if ($trashedFile->trashed_by !== $user->id && ! $user->is_admin) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        // Validate the original path is still accessible
        $username = $user->username;
        $isAdmin = $user->is_admin;
        if (! $this->isPathAccessible($trashedFile->original_path, $username, $isAdmin)) {
            return response()->json(['error' => 'Cannot restore to original location (access denied)'], 403);
        }

        // Check for conflict at original path
        if (file_exists($trashedFile->original_path)) {
            return response()->json(['error' => 'A file with the same name already exists at the original location'], 409);
        }

        $success = $this->trashManager->restore($trashedFile);

        if (! $success) {
            return response()->json(['error' => 'Failed to restore file'], 500);
        }

        return response()->json(['message' => 'File restored successfully']);
    }

    /**
     * Permanently delete a trashed file.
     */
    public function forceDelete(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'id' => 'required|integer|exists:trashed_files,id',
        ]);

        $trashedFile = TrashedFile::findOrFail($validated['id']);

        // Only allow deleting own files (or admin can delete any)
        if ($trashedFile->trashed_by !== $user->id && ! $user->is_admin) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        $success = $this->trashManager->forceDelete($trashedFile);

        if (! $success) {
            return response()->json(['error' => 'Failed to delete file'], 500);
        }

        return response()->json(['message' => 'File permanently deleted']);
    }

    /**
     * Empty all trashed files for the current user.
     */
    public function emptyTrash(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $deleted = $this->trashManager->emptyTrash($user->id);

        return response()->json(['message' => "{$deleted} item(s) permanently deleted from trash"]);
    }

    /**
     * Copy files and folders to a destination.
     */
    public function copy(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'paths' => 'required|array|min:1',
            'paths.*' => 'string',
            'destination' => 'required|string',
        ]);

        $destination = rtrim($validated['destination'], '/') ?: '/';

        if (! $this->isPathAccessible($destination, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to destination'], 403);
        }

        foreach ($validated['paths'] as $path) {
            if (! $this->isPathAccessible($path, $username, $isAdmin)) {
                return response()->json(['error' => "Access denied to: {$path}"], 403);
            }

            if (! file_exists($path)) {
                continue;
            }

            $escapedSrc = escapeshellarg($path);
            $escapedDest = escapeshellarg($destination);

            if (is_dir($path)) {
                Process::run("sudo cp -r {$escapedSrc} {$escapedDest}");
            } else {
                Process::run("sudo cp {$escapedSrc} {$escapedDest}");
            }
        }

        return response()->json(['message' => 'Copied successfully']);
    }

    /**
     * Move files and folders to a destination (for cut+paste).
     */
    public function move(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'paths' => 'required|array|min:1',
            'paths.*' => 'string',
            'destination' => 'required|string',
        ]);

        $destination = rtrim($validated['destination'], '/') ?: '/';

        if (! $this->isPathAccessible($destination, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to destination'], 403);
        }

        foreach ($validated['paths'] as $path) {
            if (! $this->isPathAccessible($path, $username, $isAdmin)) {
                return response()->json(['error' => "Access denied to: {$path}"], 403);
            }

            if (! file_exists($path)) {
                continue;
            }

            if ($this->isShareRoot($path, $username)) {
                return response()->json(['error' => 'Cannot move share root directory'], 403);
            }

            $escapedSrc = escapeshellarg($path);
            $escapedDest = escapeshellarg($destination);

            Process::run("sudo mv {$escapedSrc} {$escapedDest}");
        }

        return response()->json(['message' => 'Moved successfully']);
    }

    /**
     * Create a zip archive from selected files/folders.
     */
    public function zip(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'paths' => 'required|array|min:1',
            'paths.*' => 'string',
            'destination' => 'required|string',
            'name' => 'required|string|max:255',
        ]);

        $destination = rtrim($validated['destination'], '/') ?: '/';

        if (! $this->isPathAccessible($destination, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to destination'], 403);
        }

        // Validate all source paths
        foreach ($validated['paths'] as $path) {
            if (! $this->isPathAccessible($path, $username, $isAdmin)) {
                return response()->json(['error' => "Access denied to: {$path}"], 403);
            }

            if (! file_exists($path)) {
                return response()->json(['error' => "File not found: {$path}"], 404);
            }
        }

        $zipName = $validated['name'];
        if (! str_ends_with($zipName, '.zip')) {
            $zipName .= '.zip';
        }

        // Validate zip name follows Linux naming rules
        $baseName = pathinfo($zipName, PATHINFO_FILENAME);
        if (str_contains($baseName, '/') || $baseName === '.' || $baseName === '..' || $baseName === '' || preg_match('/[\x00]/', $baseName)) {
            return response()->json(['error' => 'Invalid archive name'], 400);
        }

        $zipPath = ($destination === '/' ? '/' : $destination.'/').$zipName;
        $escapedZipPath = escapeshellarg($zipPath);

        // Build zip command - first remove existing zip if any
        Process::run("sudo rm -f {$escapedZipPath}");

        // Build source arguments
        $sourceArgs = implode(' ', array_map('escapeshellarg', $validated['paths']));

        // Run zip command from the destination directory so paths inside the archive are relative
        $escapedDest = escapeshellarg($destination);
        $result = Process::run("cd {$escapedDest} && sudo zip -r {$escapedZipPath} {$sourceArgs} 2>&1");

        if (! $result->successful()) {
            return response()->json(['error' => 'Failed to create zip: '.$result->errorOutput()], 500);
        }

        return response()->json([
            'message' => 'Archive created successfully',
            'path' => $zipPath,
        ]);
    }

    /**
     * Extract a zip archive.
     */
    public function unzip(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'path' => 'required|string',
            'destination' => 'nullable|string',
        ]);

        $archivePath = $validated['path'];

        if (! $this->isPathAccessible($archivePath, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to this archive'], 403);
        }

        if (! is_file($archivePath)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        // Determine extraction destination
        $extractTo = $validated['destination'] ?? pathinfo($archivePath, PATHINFO_DIRNAME);

        if (! $this->isPathAccessible($extractTo, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to extraction destination'], 403);
        }

        $escapedArchive = escapeshellarg($archivePath);
        $escapedDest = escapeshellarg($extractTo);

        $result = Process::run("sudo unzip -o {$escapedArchive} -d {$escapedDest} 2>&1");

        if (! $result->successful()) {
            return response()->json(['error' => 'Failed to extract: '.$result->errorOutput()], 500);
        }

        return response()->json([
            'message' => 'Archive extracted successfully',
            'path' => $extractTo,
        ]);
    }

    /**
     * Upload files to a directory.
     *
     * Accepts multiple files with optional relative paths (for folder uploads).
     */
    public function upload(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $validated = $request->validate([
            'path' => 'required|string',
            'files' => 'required|array|min:1',
            'files.*' => 'file',
            'relative_paths' => 'required|array|min:1',
            'relative_paths.*' => 'string',
        ]);

        $destination = rtrim($validated['path'], '/') ?: '/';

        if (! $this->isPathAccessible($destination, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to this path'], 403);
        }

        // Check write permission
        $permission = $this->getUserSharePermissionForPath($destination, $username, $isAdmin);
        if ($permission !== 'readwrite') {
            return response()->json(['error' => 'Write permission required'], 403);
        }

        $files = $request->file('files');
        $relativePaths = $validated['relative_paths'];

        if (count($files) !== count($relativePaths)) {
            return response()->json(['error' => 'Files and relative paths count mismatch'], 400);
        }

        $uploaded = [];
        $errors = [];

        foreach ($files as $index => $file) {
            $relativePath = $relativePaths[$index] ?: $file->getClientOriginalName();
            $targetPath = $destination === '/' ? '/'.$relativePath : $destination.'/'.$relativePath;
            $targetDir = dirname($targetPath);

            // Validate the target path is accessible
            if (! $this->isPathAccessible($targetPath, $username, $isAdmin)) {
                $errors[] = [
                    'name' => $file->getClientOriginalName(),
                    'error' => 'Access denied',
                ];

                continue;
            }

            // Create parent directory if needed
            if (! is_dir($targetDir)) {
                $result = Process::run('sudo mkdir -p '.escapeshellarg($targetDir));
                if (! $result->successful()) {
                    $errors[] = [
                        'name' => $file->getClientOriginalName(),
                        'error' => 'Failed to create directory: '.$result->errorOutput(),
                    ];

                    continue;
                }
                Process::run('sudo chown -R '.escapeshellarg($username).':'.escapeshellarg($username).' '.escapeshellarg($targetDir));
            }

            // Save to temp location first, then use sudo cp to handle ownership
            $tempPath = $file->getRealPath();
            $escapedTemp = escapeshellarg($tempPath);
            $escapedTarget = escapeshellarg($targetPath);
            $result = Process::run("sudo cp {$escapedTemp} {$escapedTarget}");

            if (! $result->successful()) {
                $errors[] = [
                    'name' => $file->getClientOriginalName(),
                    'error' => 'Failed to save file: '.$result->errorOutput(),
                ];

                continue;
            }

            Process::run('sudo chown '.escapeshellarg($username).':'.escapeshellarg($username).' '.escapeshellarg($targetPath));

            if (file_exists($targetPath)) {
                $uploaded[] = [
                    'name' => basename($targetPath),
                    'path' => $targetPath,
                    'size' => $file->getSize(),
                ];
            } else {
                $errors[] = [
                    'name' => $file->getClientOriginalName(),
                    'error' => 'File not found after upload',
                ];
            }
        }

        return response()->json([
            'uploaded' => $uploaded,
            'errors' => $errors,
        ]);
    }

    /**
     * Download a file.
     */
    public function download(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        /** @var User $user */
        $user = $request->user();
        $username = $user->username;
        $isAdmin = $user->is_admin;

        $path = $request->input('path');

        if (empty($path)) {
            return response()->json(['error' => 'Path is required'], 422);
        }

        if (! $this->isPathAccessible($path, $username, $isAdmin)) {
            return response()->json(['error' => 'Access denied to this file'], 403);
        }

        if (! is_file($path)) {
            return response()->json(['error' => 'File not found'], 404);
        }

        return response()->download($path, basename($path), [
            'Content-Type' => mime_content_type($path) ?: 'application/octet-stream',
        ]);
    }

    /**
     * Get the user's effective permission level on the share containing a path.
     */
    protected function getUserSharePermissionForPath(string $path, string $username, bool $isAdmin): ?string
    {
        $realPath = realpath($path) ?: $path;
        $allShares = $this->sambaService->getShares();

        foreach ($allShares as $share) {
            if ($share['type'] === 'system') {
                continue;
            }

            if ($share['name'] === 'homes' && $share['enabled']) {
                $homePath = $this->getUserHomeDirectory($username);
                if (str_starts_with($realPath, $homePath) || $realPath === rtrim($homePath, '/')) {
                    return $isAdmin ? 'readwrite' : 'readwrite';
                }
            }

            if ($share['type'] === 'custom' && ! empty($share['path'])) {
                $sharePath = rtrim($share['path'], '/');
                if (str_starts_with($realPath, $sharePath) || $realPath === $sharePath) {
                    if ($isAdmin) {
                        return 'readwrite';
                    }

                    return $this->getUserSharePermission($share, $username);
                }
            }
        }

        return null;
    }

    /**
     * Check if a path is a share root directory (safety check).
     */
    protected function isShareRoot(string $path, string $username): bool
    {
        $normalized = rtrim($path, '/');
        $allShares = $this->sambaService->getShares();

        foreach ($allShares as $share) {
            if ($share['type'] === 'system') {
                continue;
            }

            if ($share['name'] === 'homes' && $share['enabled']) {
                $homePath = $this->getUserHomeDirectory($username);
                if ($normalized === rtrim($homePath, '/')) {
                    return true;
                }
            }

            if ($share['type'] === 'custom' && ! empty($share['path'])) {
                if ($normalized === rtrim($share['path'], '/')) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Get the user's effective permission level on a share.
     *
     * Returns 'readwrite', 'read', or null if no access.
     */
    protected function getUserSharePermission(array $share, string $username): ?string
    {
        // Check Samba valid users / write list
        $validUsers = $share['valid users'] ?? '';
        $writeList = $share['write list'] ?? '';
        $readList = $share['read list'] ?? '';

        // Parse space-separated user lists
        $validUsersList = $validUsers ? preg_split('/\s+/', $validUsers) : [];
        $writeListUsers = $writeList ? preg_split('/\s+/', $writeList) : [];
        $readListUsers = $readList ? preg_split('/\s+/', $readList) : [];

        // Check if user is in valid users
        $isValidUser = in_array($username, $validUsersList, true);

        // Also check for %S (current user substitution) which means any valid Samba user
        if (in_array('%S', $validUsersList, true)) {
            $isValidUser = true;
        }

        if (! $isValidUser) {
            return null;
        }

        // Determine effective permission level
        if (in_array($username, $writeListUsers, true)) {
            return 'readwrite';
        }

        if (in_array($username, $readListUsers, true)) {
            return 'read';
        }

        // If in valid users but not in read/write lists, check ACL on the path
        if (! empty($share['path']) && is_dir($share['path'])) {
            $aclPermissions = $this->aclService->getPermissions($share['path']);
            if (isset($aclPermissions[$username])) {
                return $aclPermissions[$username];
            }
        }

        // Default: if in valid users, assume read access
        return 'read';
    }

    /**
     * Get the real home directory for a user from the system.
     */
    protected function getUserHomeDirectory(string $username): string
    {
        $userInfo = posix_getpwnam($username);

        if ($userInfo && ! empty($userInfo['dir'])) {
            return $userInfo['dir'];
        }

        // Fallback (should not happen for valid users)
        return '/home/'.$username;
    }

    /**
     * Check if a path is accessible to the user.
     *
     * A path is accessible if it falls within one of the user's allowed share paths.
     */
    protected function isPathAccessible(string $path, string $username, bool $isAdmin): bool
    {
        // Normalize the path
        $realPath = realpath($path);
        if ($realPath === false) {
            // Path doesn't exist yet (e.g., creating a new folder)
            // Check if the parent exists and is accessible
            $parentPath = dirname($path);
            if ($parentPath === $path) {
                // Root
                return true;
            }

            return $this->isPathAccessible($parentPath, $username, $isAdmin);
        }

        // Get all shares
        $allShares = $this->sambaService->getShares();

        foreach ($allShares as $share) {
            if ($share['type'] === 'system') {
                continue;
            }

            // Homes share: user's home directory
            if ($share['name'] === 'homes' && $share['enabled']) {
                $homePath = $this->getUserHomeDirectory($username);
                if (str_starts_with($realPath, $homePath) || $realPath === rtrim($homePath, '/')) {
                    return true;
                }

                continue;
            }

            // Custom shares
            if ($share['type'] === 'custom' && ! empty($share['path'])) {
                $sharePath = rtrim($share['path'], '/');

                if (str_starts_with($realPath, $sharePath) || $realPath === $sharePath) {
                    // Path is within this share - check permission level
                    if ($isAdmin) {
                        return true;
                    }

                    $permission = $this->getUserSharePermission($share, $username);

                    return $permission !== null;
                }
            }
        }

        return false;
    }
}
