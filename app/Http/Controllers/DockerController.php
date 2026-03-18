<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\Process\Process;

/**
 * Controller for Docker operations using CLI commands.
 */
class DockerController extends Controller
{
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to list containers',
            ], 500);
        }

        $containers = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (!empty($line)) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to get container stats',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to list images',
            ], 500);
        }

        $images = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (!empty($line)) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to list volumes',
            ], 500);
        }

        $volumes = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (!empty($line)) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to list networks',
            ], 500);
        }

        $networks = [];
        foreach (explode("\n", trim($result['output'])) as $line) {
            if (!empty($line)) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
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

        if (!$result['success']) {
            return response()->json([
                'error' => 'Failed to prune networks',
            ], 500);
        }

        return response()->json(json_decode($result['output'], true) ?: []);
    }
}
