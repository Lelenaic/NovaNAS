<?php

namespace App\Http\Controllers;

use App\Services\SettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

class DockerComposeController extends Controller
{
    public function __construct(
        private SettingsService $settings,
    ) {}

    private function runDockerCommand(array $args): array
    {
        $result = Process::timeout(120)->run(array_merge(['docker'], $args));

        return [
            'success' => $result->successful(),
            'output' => $result->output(),
            'error' => $result->errorOutput(),
            'exitCode' => $result->exitCode(),
        ];
    }

    private function runSudoCommand(array $args): array
    {
        $result = Process::timeout(30)->run(array_merge(['sudo'], $args));

        return [
            'success' => $result->successful(),
            'output' => $result->output(),
            'error' => $result->errorOutput(),
            'exitCode' => $result->exitCode(),
        ];
    }

    private function slugifyProjectName(string $name): string
    {
        $slug = strtolower(trim($name));
        $slug = preg_replace('/[^a-z0-9-]/', '-', $slug);
        $slug = preg_replace('/-+/', '-', $slug);
        $slug = trim($slug, '-');

        return $slug;
    }

    private function validateProjectName(string $slug): ?string
    {
        if ($slug === '' || strlen($slug) > 255) {
            return 'Project name must be between 1 and 255 characters.';
        }

        if (! preg_match('/^[a-z0-9][a-z0-9-]*[a-z0-9]$/', $slug) && ! preg_match('/^[a-z0-9]$/', $slug)) {
            return 'Project name must contain only lowercase letters, digits, and hyphens, and must start and end with a letter or digit.';
        }

        return null;
    }

    private function getProjectsStoragePath(): string
    {
        $appsStorage = $this->settings->get('storage.app_folders_home');

        return $appsStorage.'/novanas_projects';
    }

    private function parseLabels(string $labelsString): array
    {
        $labels = [];

        foreach (explode(',', $labelsString) as $pair) {
            $pair = trim($pair);
            if ($pair === '') {
                continue;
            }

            $parts = explode('=', $pair, 2);
            $key = $parts[0];
            $value = $parts[1] ?? '';

            $labels[$key] = $value;
        }

        return $labels;
    }

    private function getComposeFilePath(string $projectName): ?string
    {
        $result = $this->runDockerCommand([
            'ps',
            '-a',
            '--filter',
            "label=com.docker.compose.project={$projectName}",
            '--format',
            '{{json .Labels}}',
        ]);

        if (! $result['success'] || trim($result['output']) === '') {
            return null;
        }

        foreach (explode("\n", trim($result['output'])) as $line) {
            if (empty($line)) {
                continue;
            }

            $decoded = json_decode($line, true);
            $labels = is_array($decoded) ? $decoded : $this->parseLabels((string) $decoded);

            if (isset($labels['com.docker.compose.project.config_files'])) {
                return $labels['com.docker.compose.project.config_files'];
            }
        }

        return null;
    }

    private function getProjectContainers(string $projectName): array
    {
        $result = $this->runDockerCommand([
            'ps',
            '-a',
            '--filter',
            "label=com.docker.compose.project={$projectName}",
            '--format',
            '{{json .}}',
        ]);

        if (! $result['success']) {
            return [];
        }

        $containers = [];

        foreach (explode("\n", trim($result['output'])) as $line) {
            if (! empty($line)) {
                $containers[] = json_decode($line, true);
            }
        }

        return $containers;
    }

    public function index(): JsonResponse
    {
        $result = $this->runDockerCommand([
            'ps',
            '-a',
            '--filter',
            'label=com.docker.compose.project',
            '--format',
            '{{json .}}',
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to list compose projects',
                'details' => $result['error'],
            ], 500);
        }

        $grouped = [];

        foreach (explode("\n", trim($result['output'])) as $line) {
            if (empty($line)) {
                continue;
            }

            $container = json_decode($line, true);

            if (! $container || ! isset($container['Labels'])) {
                continue;
            }

            $labels = is_array($container['Labels'])
                ? $container['Labels']
                : $this->parseLabels($container['Labels']);

            if (! isset($labels['com.docker.compose.project'])) {
                continue;
            }

            $projectName = $labels['com.docker.compose.project'];

            if (! isset($grouped[$projectName])) {
                $grouped[$projectName] = [
                    'name' => $projectName,
                    'containers' => [],
                    'running' => 0,
                    'total' => 0,
                    'compose_file' => $labels['com.docker.compose.project.config_files'] ?? null,
                    'working_dir' => $labels['com.docker.compose.project.working_dir'] ?? null,
                    'compose_version' => $labels['com.docker.compose.version'] ?? null,
                    'services' => [],
                ];
            }

            $grouped[$projectName]['containers'][] = [
                'id' => $container['ID'],
                'name' => $container['Names'],
                'image' => $container['Image'],
                'state' => $container['State'],
                'status' => $container['Status'],
                'service' => $labels['com.docker.compose.service'] ?? null,
                'ports' => $container['Ports'],
            ];

            $grouped[$projectName]['total']++;

            if (strtolower($container['State']) === 'running') {
                $grouped[$projectName]['running']++;
            }

            $service = $labels['com.docker.compose.service'] ?? null;
            if ($service && ! in_array($service, $grouped[$projectName]['services'])) {
                $grouped[$projectName]['services'][] = $service;
            }
        }

        $projects = array_values($grouped);

        usort($projects, fn ($a, $b) => strcmp($a['name'], $b['name']));

        foreach ($projects as &$project) {
            $project['status'] = $project['running'] === $project['total']
                ? 'running'
                : ($project['running'] > 0 ? 'partial' : 'stopped');

            $projectsStorage = $this->getProjectsStoragePath();
            $project['is_local'] = $project['compose_file']
                ? str_starts_with($project['compose_file'], $projectsStorage)
                : false;
        }

        return response()->json($projects);
    }

    public function show(string $name): JsonResponse
    {
        $containers = $this->getProjectContainers($name);

        if (empty($containers)) {
            return response()->json([
                'error' => 'Project not found',
            ], 404);
        }

        $composeFile = $this->getComposeFilePath($name);
        $composeContent = null;

        if (File::exists($composeFile)) {
            if (is_readable($composeFile)) {
                $composeContent = File::get($composeFile);
            } else {
                $result = $this->runSudoCommand(['cat', $composeFile]);
                $composeContent = $result['success'] ? $result['output'] : null;
            }
        }

        $services = [];
        $running = 0;
        $firstLabels = [];

        foreach ($containers as $container) {
            $labels = is_array($container['Labels'])
                ? $container['Labels']
                : $this->parseLabels($container['Labels']);

            if (empty($firstLabels)) {
                $firstLabels = $labels;
            }

            $services[] = [
                'name' => $labels['com.docker.compose.service'] ?? 'unknown',
                'image' => $container['Image'],
                'state' => $container['State'],
                'status' => $container['Status'],
                'container_name' => $container['Names'],
                'container_id' => $container['ID'],
                'ports' => $container['Ports'],
            ];

            if (strtolower($container['State']) === 'running') {
                $running++;
            }
        }

        $projectsStorage = $this->getProjectsStoragePath();

        return response()->json([
            'name' => $name,
            'compose_file' => $composeFile,
            'compose_content' => $composeContent,
            'working_dir' => $firstLabels['com.docker.compose.project.working_dir'] ?? null,
            'compose_version' => $firstLabels['com.docker.compose.version'] ?? null,
            'services' => $services,
            'running' => $running,
            'total' => count($containers),
            'status' => $running === count($containers)
                ? 'running'
                : ($running > 0 ? 'partial' : 'stopped'),
            'is_local' => $composeFile ? str_starts_with($composeFile, $projectsStorage) : false,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'compose_content' => 'required|string',
        ]);

        $slug = $this->slugifyProjectName($request->input('name'));
        $error = $this->validateProjectName($slug);

        if ($error) {
            return response()->json(['error' => $error], 422);
        }

        $projectsStorage = $this->getProjectsStoragePath();
        $projectDir = $projectsStorage.'/'.$slug;

        if (! is_dir($projectDir)) {
            if (! is_dir($projectsStorage)) {
                $this->runSudoCommand(['mkdir', '-p', $projectsStorage]);
                $this->runSudoCommand(['chown', get_current_user().':'.get_current_user(), $projectsStorage]);
            }

            $this->runSudoCommand(['mkdir', '-p', $projectDir]);
            $this->runSudoCommand(['chown', get_current_user().':'.get_current_user(), $projectDir]);
        }

        $composeFile = $projectDir.'/compose.yaml';
        File::put($composeFile, $request->input('compose_content'));

        $result = $this->runDockerCommand([
            'compose',
            '-f',
            $composeFile,
            'up',
            '-d',
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to start project',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'name' => $slug,
            'compose_file' => $composeFile,
            'message' => "Project '{$slug}' created successfully",
        ]);
    }

    public function update(Request $request, string $name): JsonResponse
    {
        $request->validate([
            'compose_content' => 'required|string',
        ]);

        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        if (! File::exists($composeFile)) {
            return response()->json([
                'error' => 'Compose file not found',
            ], 404);
        }

        // Try direct write first, fall back to sudo for root-owned files
        if (is_writable($composeFile)) {
            File::put($composeFile, $request->input('compose_content'));
        } else {
            $tmpFile = tempnam(sys_get_temp_dir(), 'compose_');
            File::put($tmpFile, $request->input('compose_content'));
            $this->runSudoCommand(['cp', $tmpFile, $composeFile]);
            $this->runSudoCommand(['chown', get_current_user().':'.get_current_user(), $composeFile]);
            unlink($tmpFile);
        }

        $workingDir = dirname($composeFile);

        $result = $this->runDockerCommand([
            'compose',
            '-f',
            $composeFile,
            '-p',
            $name,
            'up',
            '-d',
            '--remove-orphans',
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to update project',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Project '{$name}' updated successfully",
        ]);
    }

    public function destroy(Request $request, string $name): JsonResponse
    {
        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        $args = ['compose'];

        if (File::exists($composeFile)) {
            $args[] = '-f';
            $args[] = $composeFile;
        }

        $args[] = '-p';
        $args[] = $name;
        $args[] = 'down';

        if ($request->boolean('v', false)) {
            $args[] = '-v';
        }

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to stop project',
                'details' => $result['error'],
            ], 500);
        }

        if (File::exists($composeFile)) {
            $projectDir = dirname($composeFile);
            $projectsStorage = $this->getProjectsStoragePath();

            if (str_starts_with($projectDir, $projectsStorage)) {
                $this->runSudoCommand(['rm', '-rf', $projectDir]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Project '{$name}' removed",
        ]);
    }

    public function start(string $name): JsonResponse
    {
        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        $args = ['compose'];

        if (File::exists($composeFile)) {
            $args[] = '-f';
            $args[] = $composeFile;
        }

        $args[] = '-p';
        $args[] = $name;
        $args[] = 'up';
        $args[] = '-d';

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to start project',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    public function stop(string $name): JsonResponse
    {
        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        $args = ['compose'];

        if (File::exists($composeFile)) {
            $args[] = '-f';
            $args[] = $composeFile;
        }

        $args[] = '-p';
        $args[] = $name;
        $args[] = 'stop';

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to stop project',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    public function restart(string $name): JsonResponse
    {
        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        $args = ['compose'];

        if (File::exists($composeFile)) {
            $args[] = '-f';
            $args[] = $composeFile;
        }

        $args[] = '-p';
        $args[] = $name;
        $args[] = 'restart';

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to restart project',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    public function logs(Request $request, string $name): JsonResponse
    {
        $composeFile = $this->getComposeFilePath($name);

        if (! $composeFile) {
            $projectsStorage = $this->getProjectsStoragePath();
            $composeFile = $projectsStorage.'/'.$name.'/compose.yaml';
        }

        $args = ['compose'];

        if (File::exists($composeFile)) {
            $args[] = '-f';
            $args[] = $composeFile;
        }

        $args[] = '-p';
        $args[] = $name;
        $args[] = 'logs';

        if ($request->has('tail')) {
            $args[] = '--tail';
            $args[] = (string) $request->input('tail', 100);
        }

        if ($request->boolean('timestamps', false)) {
            $args[] = '-t';
        }

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get project logs',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'logs' => $result['output'],
        ]);
    }
}
