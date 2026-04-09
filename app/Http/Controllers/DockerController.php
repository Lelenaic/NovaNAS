<?php

namespace App\Http\Controllers;

use App\Services\LinuxUserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\Process;

/**
 * Controller for Docker operations using CLI commands.
 */
class DockerController extends Controller
{
    public function __construct(
        private LinuxUserService $linuxUserService,
    ) {}

    /**
     * Run a docker command and return the output.
     */
    private function runDockerCommand(array $args): array
    {
        $process = new Process(array_merge(['docker'], $args));
        $process->setTimeout(60);
        $process->run();

        return [
            'success' => $process->isSuccessful(),
            'output' => $process->getOutput(),
            'error' => $process->getErrorOutput(),
            'exitCode' => $process->getExitCode(),
        ];
    }

    /**
     * Get the Docker config file path.
     */
    private function getDockerConfigPath(): string
    {
        return $this->linuxUserService->getHomeDirectory(allowRoot: true).'/.docker/config.json';
    }

    /**
     * Normalize registry address to a consistent format.
     */
    private function normalizeRegistryAddress(string $address): string
    {
        // Handle Docker Hub variants - including the v1 path variant
        if (str_contains($address, 'index.docker.io') || str_contains($address, 'docker.io') || $address === 'https://docker.io') {
            return 'docker.io';
        }

        // Remove protocol prefix
        if (str_starts_with($address, 'https://')) {
            return rtrim(str_replace('https://', '', $address), '/');
        }
        if (str_starts_with($address, 'http://')) {
            return rtrim(str_replace('http://', '', $address), '/');
        }

        return rtrim($address, '/');
    }

    /**
     * Check if this looks like a valid registry address (not a sub-path).
     */
    private function isValidRegistryAddress(string $address): bool
    {
        // These are not real registries - they're sub-paths or tokens
        // Note: /v1/ and /v2/ are API paths, not the registry itself
        // The actual Docker Hub registry is https://index.docker.io/v1/
        // which should NOT be filtered out - it's the standard Docker Hub config key
        $invalidPatterns = [
            'access-token',
            'refresh-token',
            '/token',
        ];

        foreach ($invalidPatterns as $pattern) {
            if (str_contains($address, $pattern)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Read and parse Docker config.json to get logged-in registries.
     *
     * @return array<string, array{address: string, username: string, isLoggedIn: bool, originalAddress: string}>
     */
    private function getLoggedInRegistries(): array
    {
        $configPath = $this->getDockerConfigPath();

        if (! File::exists($configPath)) {
            return [];
        }

        $content = File::get($configPath);
        $config = json_decode($content, true);

        if (! isset($config['auths']) || ! is_array($config['auths'])) {
            return [];
        }

        $registries = [];

        foreach ($config['auths'] as $originalAddress => $authData) {
            // Skip invalid registry addresses
            if (! $this->isValidRegistryAddress($originalAddress)) {
                continue;
            }

            // Normalize the address for display
            $displayAddress = $this->normalizeRegistryAddress($originalAddress);

            // Check if actually logged in (has non-empty auth)
            $isLoggedIn = false;
            $username = '';

            if (isset($authData['auth']) && ! empty($authData['auth'])) {
                $isLoggedIn = true;

                // Try to extract username from auth (base64 encoded "username:password" or just token)
                $decoded = base64_decode($authData['auth'], true);
                if ($decoded !== false) {
                    if (str_contains($decoded, ':')) {
                        // Has username:password format
                        $parts = explode(':', $decoded, 2);
                        $username = $parts[0];
                    } else {
                        // Just a token - can't extract username
                        $username = '(token)';
                    }
                }
            } elseif (isset($authData['username'])) {
                $username = $authData['username'];
                $isLoggedIn = true;
            }

            // Skip if not logged in
            if (! $isLoggedIn) {
                continue;
            }

            // If this is Docker Hub and we already have it, don't duplicate
            if ($displayAddress === 'docker.io' && isset($registries['docker.io'])) {
                continue;
            }

            $registries[$displayAddress] = [
                'address' => $displayAddress,
                'username' => $username,
                'isLoggedIn' => true,
                'originalAddress' => $originalAddress,
            ];
        }

        return $registries;
    }

    /**
     * List all registries with their login status.
     */
    public function listRegistries(): JsonResponse
    {
        $configPath = $this->getDockerConfigPath();

        $loggedInRegistries = $this->getLoggedInRegistries();

        // Always include Docker Hub
        $registries = [];

        if (isset($loggedInRegistries['docker.io'])) {
            $registries[] = $loggedInRegistries['docker.io'];
        } else {
            $registries[] = [
                'address' => 'docker.io',
                'username' => '',
                'isLoggedIn' => false,
            ];
        }

        // Add other registries
        foreach ($loggedInRegistries as $address => $registry) {
            if ($address !== 'docker.io') {
                $registries[] = $registry;
            }
        }

        return response()->json([
            'registries' => $registries,
        ]);
    }

    /**
     * Add a new registry with credentials and login.
     */
    public function addRegistry(Request $request): JsonResponse
    {
        $address = $request->input('address');
        $username = $request->input('username');
        $password = $request->input('password');

        if (empty($address) || empty($username) || empty($password)) {
            return response()->json([
                'error' => 'Address, username, and password are required',
            ], 422);
        }

        // Normalize address
        $normalizedAddress = trim($address);
        if ($normalizedAddress === 'docker.io' || $normalizedAddress === 'index.docker.io') {
            $normalizedAddress = 'docker.io';
        }

        // Login to registry using docker login command with --password-stdin for non-interactive mode
        $loginArgs = ['login', '--password-stdin'];

        if ($normalizedAddress !== 'docker.io') {
            $loginArgs[] = $normalizedAddress;
        }

        // Always specify -u username with --password-stdin
        $loginArgs[] = '-u';
        $loginArgs[] = $username;

        $process = new Process(array_merge(['docker'], $loginArgs));
        // Pass password via stdin using --password-stdin
        $process->setInput($password);
        $process->setTimeout(60);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = $process->getErrorOutput();

            // Provide a more helpful error message
            if (str_contains($error, 'unauthorized') || str_contains($error, 'authentication')) {
                return response()->json([
                    'error' => 'Authentication failed. Please check your username and password.',
                    'details' => $error,
                ], 500);
            }

            return response()->json([
                'error' => 'Failed to login to registry',
                'details' => $error,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully logged in to {$normalizedAddress}",
        ]);
    }

    /**
     * Login to an existing registry (requires re-entering credentials).
     */
    public function loginToRegistry(Request $request, string $address): JsonResponse
    {
        $username = $request->input('username');
        $password = $request->input('password');

        if (empty($username) || empty($password)) {
            return response()->json([
                'error' => 'Username and password are required',
            ], 422);
        }

        $normalizedAddress = urldecode($address);

        if ($normalizedAddress === 'docker.io') {
            $normalizedAddress = 'docker.io';
        }

        // Login to registry using docker login command with --password-stdin for non-interactive mode
        $loginArgs = ['login', '--password-stdin'];

        if ($normalizedAddress !== 'docker.io') {
            $loginArgs[] = $normalizedAddress;
        }

        // Always specify -u username with --password-stdin
        $loginArgs[] = '-u';
        $loginArgs[] = $username;

        $process = new Process(array_merge(['docker'], $loginArgs));
        // Pass password via stdin using --password-stdin
        $process->setInput($password);
        $process->setTimeout(60);
        $process->run();

        if (! $process->isSuccessful()) {
            $error = $process->getErrorOutput();

            return response()->json([
                'error' => 'Failed to login to registry',
                'details' => $error,
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully logged in to {$normalizedAddress}",
        ]);
    }

    /**
     * Logout from a registry - directly modifies config to remove all related entries.
     */
    public function logoutFromRegistry(string $address): JsonResponse
    {
        $normalizedAddress = urldecode($address);

        if ($normalizedAddress === 'docker.io') {
            $normalizedAddress = 'docker.io';
        }

        // Get the config file path
        $configPath = $this->getDockerConfigPath();

        if (! File::exists($configPath)) {
            return response()->json([
                'error' => 'Docker config file not found',
            ], 500);
        }

        // Read current config
        $content = File::get($configPath);
        $config = json_decode($content, true);

        if (! isset($config['auths']) || ! is_array($config['auths'])) {
            return response()->json([
                'error' => 'Invalid docker config',
            ], 500);
        }

        // Find all keys to remove for this registry
        $keysToRemove = [];

        if ($normalizedAddress === 'docker.io') {
            // For docker.io, remove all related entries
            foreach (array_keys($config['auths']) as $key) {
                if (str_contains($key, 'index.docker.io')) {
                    $keysToRemove[] = $key;
                }
            }
        } else {
            // For other registries, look for exact match or with https:// prefix
            $searchKeys = [
                $normalizedAddress,
                'https://'.$normalizedAddress,
                'http://'.$normalizedAddress,
            ];

            foreach (array_keys($config['auths']) as $key) {
                if (in_array($key, $searchKeys)) {
                    $keysToRemove[] = $key;
                }
            }
        }

        // Remove the keys
        foreach ($keysToRemove as $key) {
            unset($config['auths'][$key]);
        }

        // Write back the config (JSON_UNESCAPED_SLASHES prevents escaping forward slashes)
        $newContent = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        File::put($configPath, $newContent);

        return response()->json([
            'success' => true,
            'message' => "Successfully logged out from {$normalizedAddress}",
        ]);
    }

    /**
     * Remove a registry (logout only, as we don't track configured registries separately).
     */
    public function removeRegistry(string $address): JsonResponse
    {
        $normalizedAddress = urldecode($address);

        // Just logout - we read directly from docker config
        $args = ['logout'];
        if ($normalizedAddress !== 'docker.io') {
            $args[] = $normalizedAddress;
        }

        $result = $this->runDockerCommand($args);

        // Even if logout fails (not logged in), consider it success for removal
        return response()->json([
            'success' => true,
            'message' => "Registry {$normalizedAddress} removed",
        ]);
    }

    /**
     * Check if Docker is available and running.
     */
    public function ping(): JsonResponse
    {
        $result = $this->runDockerCommand(['info']);

        if ($result['success']) {
            return response()->json([
                'available' => true,
                'message' => 'Docker is running',
            ]);
        }

        return response()->json([
            'available' => false,
            'message' => 'Docker is not available',
        ], 503);
    }

    /**
     * Get Docker system information.
     */
    public function info(): JsonResponse
    {
        $result = $this->runDockerCommand(['info', '--format', '{{json .}}']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get Docker info',
                'details' => $result['error'],
            ], 500);
        }

        $data = json_decode($result['output'], true);

        return response()->json($data ?: []);
    }

    /**
     * Get Docker version information.
     */
    public function version(): JsonResponse
    {
        $result = $this->runDockerCommand(['version', '--format', '{{json .}}']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get Docker version',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }

    // ==================== CONTAINERS ====================

    /**
     * List all containers.
     */
    public function containers(Request $request): JsonResponse
    {
        $all = $request->boolean('all', true) ? '-a' : '';
        $format = '--format={{json .}}';

        $args = array_filter(['ps', $all, $format]);
        $result = $this->runDockerCommand(array_values($args));

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to list containers',
            ], 500);
        }

        $containers = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (! empty($line)) {
                $containers[] = json_decode($line, true);
            }
        }

        return response()->json($containers ?: []);
    }

    /**
     * Get container details.
     */
    public function container(string $id): JsonResponse
    {
        $result = $this->runDockerCommand([
            'inspect',
            '--format={{json .}}',
            $id,
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get container',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true));
    }

    /**
     * Start a container.
     */
    public function startContainer(string $id): JsonResponse
    {
        $result = $this->runDockerCommand(['start', $id]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to start container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Stop a container.
     */
    public function stopContainer(Request $request, string $id): JsonResponse
    {
        $t = $request->input('t', 10);
        $result = $this->runDockerCommand(['stop', '-t', $t, $id]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to stop container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Restart a container.
     */
    public function restartContainer(Request $request, string $id): JsonResponse
    {
        $t = $request->input('t', 10);
        $result = $this->runDockerCommand(['restart', '-t', $t, $id]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to restart container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Remove a container.
     */
    public function removeContainer(Request $request, string $id): JsonResponse
    {
        $args = ['rm'];
        if ($request->boolean('v', false)) {
            $args[] = '-v';
        }
        if ($request->boolean('force', false)) {
            $args[] = '-f';
        }
        $args[] = $id;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to remove container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Get container logs.
     */
    public function containerLogs(Request $request, string $id): JsonResponse
    {
        $args = ['logs'];
        if ($request->boolean('tail', false)) {
            $args[] = '--tail';
            $args[] = $request->input('tail', 100);
        }
        if ($request->boolean('timestamps', false)) {
            $args[] = '-t';
        }
        $args[] = $id;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get container logs',
            ], 500);
        }

        return response()->json([
            'logs' => $result['output'],
        ]);
    }

    /**
     * Get container stats.
     */
    public function containerStats(Request $request, string $id): JsonResponse
    {
        $noStream = $request->boolean('stream', false) ? '' : '--no-stream';
        $format = '--format={{json .}}';

        $args = array_filter(['stats', $noStream, $format, $id]);
        $result = $this->runDockerCommand(array_values($args));

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get container stats',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }

    /**
     * Create a container.
     */
    public function createContainer(Request $request): JsonResponse
    {
        $name = $request->input('name');
        $image = $request->input('image');
        $tag = $request->input('tag', 'latest');
        $registry = $request->input('registry');
        $restartPolicy = $request->input('restart_policy', 'no');
        $labels = $request->input('labels', []);
        $ports = $request->input('ports', []);
        $volumes = $request->input('volumes', []);
        $environment = $request->input('environment', []);
        $envFile = $request->input('env_file');

        if (empty($name) || empty($image)) {
            return response()->json([
                'error' => 'Container name and image are required',
            ], 422);
        }

        // Build the full image name with registry
        $imageName = $image;
        if (! empty($registry)) {
            // Prepend registry to image (e.g., registry.example.com/nginx)
            $imageName = "{$registry}/{$image}";
        }
        if ($tag) {
            $imageName = "{$imageName}:{$tag}";
        }

        $args = ['run', '-d', '--name', $name];

        foreach ($labels as $label) {
            $args[] = '--label';
            $args[] = $label;
        }

        $restartMap = [
            'no' => 'no',
            'on-failure' => 'on-failure',
            'always' => 'always',
            'unless-stopped' => 'unless-stopped',
        ];
        $args[] = '--restart';
        $args[] = $restartMap[$restartPolicy] ?? 'no';

        foreach ($ports as $port) {
            if (! empty($port['host']) && ! empty($port['container'])) {
                $args[] = '-p';
                $args[] = "{$port['host']}:{$port['container']}";
            }
        }

        foreach ($volumes as $volume) {
            if (! empty($volume['container_path'])) {
                $args[] = '-v';
                if ($volume['type'] === 'bind' && ! empty($volume['host_path'])) {
                    $args[] = "{$volume['host_path']}:{$volume['container_path']}";
                } elseif ($volume['type'] === 'volume' && ! empty($volume['volume_name'])) {
                    $args[] = "{$volume['volume_name']}:{$volume['container_path']}";
                }
            }
        }

        foreach ($environment as $env) {
            if (! empty($env['key'])) {
                $args[] = '-e';
                $args[] = "{$env['key']}={$env['value']}";
            }
        }

        if (! empty($envFile)) {
            $args[] = '--env-file';
            $args[] = $envFile;
        }

        $args[] = $imageName;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to create container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Container {$name} created successfully",
        ]);
    }

    /**
     * Recreate a container (stop, remove, create new).
     */
    public function recreateContainer(Request $request, string $id): JsonResponse
    {
        $inspectResult = $this->runDockerCommand(['inspect', '--format={{json .}}', $id]);

        if (! $inspectResult['success']) {
            return response()->json([
                'error' => 'Container not found',
            ], 404);
        }

        $containerConfig = json_decode($inspectResult['output'], true);
        $oldName = trim($containerConfig['Name'], '/');

        $name = $request->input('name', $oldName);
        $image = $request->input('image', $containerConfig['Config']['Image']);
        $tag = $request->input('tag', 'latest');
        $registry = $request->input('registry');
        $restartPolicy = $request->input('restart_policy', 'no');
        $labels = $request->input('labels', []);
        $ports = $request->input('ports', []);
        $volumes = $request->input('volumes', []);
        $environment = $request->input('environment', []);
        $envFile = $request->input('env_file');

        $this->runDockerCommand(['stop', $id]);
        $rmResult = $this->runDockerCommand(['rm', '-f', $id]);

        if (! $rmResult['success']) {
            return response()->json([
                'error' => 'Failed to remove container',
                'details' => $rmResult['error'],
            ], 500);
        }

        // Build the full image name with registry
        $imageName = $image;
        if (! empty($registry)) {
            // Prepend registry to image (e.g., registry.example.com/nginx)
            $imageName = "{$registry}/{$image}";
        }
        if ($tag) {
            $imageName = "{$imageName}:{$tag}";
        }

        $args = ['run', '-d', '--name', $name];

        foreach ($labels as $label) {
            $args[] = '--label';
            $args[] = $label;
        }

        $restartMap = [
            'no' => 'no',
            'on-failure' => 'on-failure',
            'always' => 'always',
            'unless-stopped' => 'unless-stopped',
        ];
        $args[] = '--restart';
        $args[] = $restartMap[$restartPolicy] ?? 'no';

        foreach ($ports as $port) {
            if (! empty($port['host']) && ! empty($port['container'])) {
                $args[] = '-p';
                $args[] = "{$port['host']}:{$port['container']}";
            }
        }

        foreach ($volumes as $volume) {
            if (! empty($volume['container_path'])) {
                $args[] = '-v';
                if ($volume['type'] === 'bind' && ! empty($volume['host_path'])) {
                    $args[] = "{$volume['host_path']}:{$volume['container_path']}";
                } elseif ($volume['type'] === 'volume' && ! empty($volume['volume_name'])) {
                    $args[] = "{$volume['volume_name']}:{$volume['container_path']}";
                }
            }
        }

        foreach ($environment as $env) {
            if (! empty($env['key'])) {
                $args[] = '-e';
                $args[] = "{$env['key']}={$env['value']}";
            }
        }

        if (! empty($envFile)) {
            $args[] = '--env-file';
            $args[] = $envFile;
        }

        $args[] = $imageName;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to create new container',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Container {$name} recreated successfully",
        ]);
    }

    /**
     * Get container config for editing.
     */
    public function getContainerConfig(string $id): JsonResponse
    {
        $result = $this->runDockerCommand(['inspect', '--format={{json .}}', $id]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get container config',
            ], 500);
        }

        $config = json_decode($result['output'], true);

        $labels = [];
        if (! empty($config['Config']['Labels'])) {
            foreach ($config['Config']['Labels'] as $key => $value) {
                $labels[] = "{$key}={$value}";
            }
        }

        $parsed = [
            'id' => $config['Id'],
            'name' => trim($config['Name'], '/'),
            'image' => $config['Config']['Image'],
            'restart_policy' => $config['HostConfig']['RestartPolicy']['Name'] ?? 'no',
            'labels' => $labels,
            'ports' => [],
            'volumes' => [],
            'environment' => [],
        ];

        if (! empty($config['HostConfig']['PortBindings'])) {
            foreach ($config['HostConfig']['PortBindings'] as $containerPort => $bindings) {
                if (! empty($bindings)) {
                    foreach ($bindings as $binding) {
                        $parsed['ports'][] = [
                            'host' => $binding['HostPort'] ?? '',
                            'container' => str_replace('/tcp', '', str_replace('/udp', '', $containerPort)),
                        ];
                    }
                }
            }
        }

        if (! empty($config['HostConfig']['Binds'])) {
            $binds = is_array($config['HostConfig']['Binds'])
                ? $config['HostConfig']['Binds']
                : [$config['HostConfig']['Binds']];

            foreach ($binds as $bind) {
                $parts = explode(':', $bind);
                if (count($parts) >= 2) {
                    $hostPath = $parts[0];
                    $containerPath = $parts[1];
                    $isVolume = strpos($hostPath, '/') !== 0 && strpos($hostPath, ':') === false;

                    $parsed['volumes'][] = [
                        'type' => $isVolume ? 'volume' : 'bind',
                        'host_path' => $isVolume ? '' : $hostPath,
                        'volume_name' => $isVolume ? $hostPath : '',
                        'container_path' => $containerPath,
                    ];
                }
            }
        }

        if (! empty($config['Config']['Env'])) {
            foreach ($config['Config']['Env'] as $env) {
                $parts = explode('=', $env, 2);
                if (count($parts) === 2) {
                    $parsed['environment'][] = [
                        'key' => $parts[0],
                        'value' => $parts[1],
                    ];
                }
            }
        }

        return response()->json($parsed);
    }

    // ==================== IMAGES ====================

    /**
     * List all images.
     */
    public function images(Request $request): JsonResponse
    {
        $all = $request->boolean('all', false) ? '-a' : '';
        $format = '--format={{json .}}';

        $args = array_filter(['images', $all, $format]);
        $result = $this->runDockerCommand(array_values($args));

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to list images',
            ], 500);
        }

        $images = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (! empty($line)) {
                $images[] = json_decode($line, true);
            }
        }

        return response()->json($images ?: []);
    }

    /**
     * Get image details.
     */
    public function image(string $id): JsonResponse
    {
        $result = $this->runDockerCommand([
            'image',
            'inspect',
            '--format={{json .}}',
            $id,
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get image',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true));
    }

    /**
     * Pull an image.
     */
    public function pull(Request $request): JsonResponse
    {
        $image = $request->input('image');
        $tag = $request->input('tag', 'latest');

        if (empty($image)) {
            return response()->json([
                'error' => 'Image name is required',
            ], 422);
        }

        $imageName = $tag ? "{$image}:{$tag}" : $image;
        $result = $this->runDockerCommand(['pull', $imageName]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to pull image',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'success' => true,
            'message' => "Image {$imageName} pulled successfully",
        ]);
    }

    /**
     * Remove an image.
     */
    public function removeImage(Request $request, string $id): JsonResponse
    {
        $args = ['rmi'];
        if ($request->boolean('force', false)) {
            $args[] = '-f';
        }
        if ($request->boolean('noprune', false)) {
            $args[] = '--no-prune';
        }
        $args[] = $id;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to remove image',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    // ==================== VOLUMES ====================

    /**
     * List all volumes.
     */
    public function volumes(): JsonResponse
    {
        $result = $this->runDockerCommand([
            'volume',
            'ls',
            '--format',
            '{{json .}}',
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to list volumes',
            ], 500);
        }

        $volumes = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (! empty($line)) {
                $volumes[] = json_decode($line, true);
            }
        }

        return response()->json(['Volumes' => $volumes ?: []]);
    }

    /**
     * Create a volume.
     */
    public function createVolume(Request $request): JsonResponse
    {
        $name = $request->input('name');
        $driver = $request->input('driver', 'local');

        if (empty($name)) {
            return response()->json([
                'error' => 'Volume name is required',
            ], 422);
        }

        $args = ['volume', 'create', '--name', $name, '--driver', $driver];
        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to create volume',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'Name' => $name,
            'Driver' => $driver,
        ]);
    }

    /**
     * Get volume details.
     */
    public function volume(string $name): JsonResponse
    {
        $result = $this->runDockerCommand([
            'volume',
            'inspect',
            '--format={{json .}}',
            $name,
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get volume',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true));
    }

    /**
     * Remove a volume.
     */
    public function removeVolume(Request $request, string $name): JsonResponse
    {
        $args = ['volume', 'rm'];
        if ($request->boolean('force', false)) {
            $args[] = '-f';
        }
        $args[] = $name;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to remove volume',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    // ==================== NETWORKS ====================

    /**
     * List all networks.
     */
    public function networks(): JsonResponse
    {
        $result = $this->runDockerCommand([
            'network',
            'ls',
            '--format',
            '{{json .}}',
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to list networks',
            ], 500);
        }

        $networks = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (! empty($line)) {
                $networks[] = json_decode($line, true);
            }
        }

        return response()->json($networks ?: []);
    }

    /**
     * Get network details.
     */
    public function network(string $id): JsonResponse
    {
        $result = $this->runDockerCommand([
            'network',
            'inspect',
            '--format={{json .}}',
            $id,
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to get network',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true));
    }

    /**
     * Create a network.
     */
    public function createNetwork(Request $request): JsonResponse
    {
        $name = $request->input('name');
        $driver = $request->input('driver', 'bridge');

        if (empty($name)) {
            return response()->json([
                'error' => 'Network name is required',
            ], 422);
        }

        $args = ['network', 'create', '--driver', $driver, $name];

        $subnet = $request->input('subnet');
        $gateway = $request->input('gateway');

        if ($subnet || $gateway) {
            $args[] = '--subnet';
            $args[] = $subnet;
            $args[] = '--gateway';
            $args[] = $gateway;
        }

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to create network',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json([
            'Id' => trim($result['output']),
            'Name' => $name,
            'Driver' => $driver,
        ]);
    }

    /**
     * Remove a network.
     */
    public function removeNetwork(string $id): JsonResponse
    {
        $result = $this->runDockerCommand(['network', 'rm', $id]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to remove network',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Connect a container to a network.
     */
    public function connectNetwork(Request $request, string $networkId): JsonResponse
    {
        $containerId = $request->input('containerId');

        if (empty($containerId)) {
            return response()->json([
                'error' => 'Container ID is required',
            ], 422);
        }

        $result = $this->runDockerCommand([
            'network',
            'connect',
            $networkId,
            $containerId,
        ]);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to connect container to network',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Disconnect a container from a network.
     */
    public function disconnectNetwork(Request $request, string $networkId): JsonResponse
    {
        $containerId = $request->input('containerId');
        $force = $request->boolean('force', false);

        if (empty($containerId)) {
            return response()->json([
                'error' => 'Container ID is required',
            ], 422);
        }

        $args = ['network', 'disconnect'];
        if ($force) {
            $args[] = '-f';
        }
        $args[] = $networkId;
        $args[] = $containerId;

        $result = $this->runDockerCommand($args);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to disconnect container from network',
                'details' => $result['error'],
            ], 500);
        }

        return response()->json(['success' => true]);
    }

    // ==================== PRUNE ====================

    /**
     * Prune unused containers.
     */
    public function pruneContainers(): JsonResponse
    {
        $result = $this->runDockerCommand(['container', 'prune', '-f']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to prune containers',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }

    /**
     * Prune unused images.
     */
    public function pruneImages(): JsonResponse
    {
        $result = $this->runDockerCommand(['image', 'prune', '-a', '-f']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to prune images',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }

    /**
     * Prune unused volumes.
     */
    public function pruneVolumes(): JsonResponse
    {
        $result = $this->runDockerCommand(['volume', 'prune', '-f']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to prune volumes',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }

    /**
     * Prune unused networks.
     */
    public function pruneNetworks(): JsonResponse
    {
        $result = $this->runDockerCommand(['network', 'prune', '-f']);

        if (! $result['success']) {
            return response()->json([
                'error' => 'Failed to prune networks',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }
}
