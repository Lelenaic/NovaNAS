<?php

namespace App\Services\GPU\Providers;

use App\Contracts\GPUInterface;
use Symfony\Component\Process\Process;

/**
 * NVIDIA GPU provider implementation.
 *
 * Uses nvidia-smi to query NVIDIA GPU information.
 */
class NvidiaGPU implements GPUInterface
{
    /**
     * The path to nvidia-smi command.
     */
    protected const NVIDIA_SMI = '/usr/bin/nvidia-smi';

    /**
     * Get the provider name/identifier.
     */
    public function getProviderName(): string
    {
        return 'nvidia';
    }

    /**
     * Get the display name for the provider.
     */
    public function getDisplayName(): string
    {
        return 'NVIDIA';
    }

    /**
     * Check if the NVIDIA driver is installed.
     */
    public function isDriverInstalled(): bool
    {
        $process = new Process([self::NVIDIA_SMI, '--version']);
        $process->run();

        return $process->isSuccessful();
    }

    /**
     * Get the driver version if installed.
     */
    public function getDriverVersion(): ?string
    {
        if (!$this->isDriverInstalled()) {
            return null;
        }

        $process = new Process([
            self::NVIDIA_SMI,
            '--query-gpu=driver_version',
            '--format=csv,noheader',
        ]);
        $process->run();

        if (!$process->isSuccessful()) {
            return null;
        }

        return trim($process->getOutput());
    }

    /**
     * List all available NVIDIA GPUs with their details.
     *
     * @return array<int, array{
     *     index: int,
     *     name: string,
     *     uuid: string,
     *     memory_total: int,
     *     memory_used: int,
     *     memory_free: int,
     *     utilization_gpu: int,
     *     utilization_memory: int,
     *     temperature: int,
     *     power_draw: float,
     *     power_limit: float,
     *     clock_sm: int|null,
     *     clock_memory: int|null,
     *     driver: string,
     *     cuda_version: string,
     *     vbios_version: string|null,
     *     persistence_mode: bool|null,
     *     ecc_enabled: bool|null,
     * }>
     */
    public function listGpus(): array
    {
        if (!$this->isDriverInstalled()) {
            return [];
        }

        // Query all GPUs with basic information (fields that work on all GPUs)
        $process = new Process([
            self::NVIDIA_SMI,
            '--query-gpu=index,name,uuid,memory.total,memory.used,memory.free,'
            . 'utilization.gpu,utilization.memory,temperature.gpu,'
            . 'power.draw,power.limit,driver_version',
            '--format=csv,noheader,nounits',
        ]);
        $process->run();

        if (!$process->isSuccessful()) {
            return [];
        }

        $output = trim($process->getOutput());
        $lines = explode("\n", $output);

        $gpus = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            $fields = array_map('trim', explode(',', $line));

            // Basic fields: index,name,uuid,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory,temperature.gpu,power.draw,power_limit,driver_version
            if (count($fields) >= 12) {
                $gpus[] = [
                    'index' => (int) $fields[0],
                    'name' => $fields[1],
                    'uuid' => $fields[2],
                    'memory_total' => (int) $fields[3] * 1024 * 1024, // Convert MB to bytes
                    'memory_used' => (int) $fields[4] * 1024 * 1024,
                    'memory_free' => (int) $fields[5] * 1024 * 1024,
                    'utilization_gpu' => (int) $fields[6],
                    'utilization_memory' => (int) $fields[7],
                    'temperature' => (int) $fields[8],
                    'power_draw' => (float) $fields[9],
                    'power_limit' => (float) $fields[10],
                    'clock_sm' => null,
                    'clock_memory' => null,
                    'driver' => $fields[11],
                    'cuda_version' => $this->getCudaVersion(),
                    'vbios_version' => null,
                    'persistence_mode' => null,
                    'ecc_enabled' => null,
                ];
            }
        }

        // Try to get optional clock information (may not work on older GPUs)
        $gpus = $this->addOptionalGpuInfo($gpus);

        return $gpus;
    }

    /**
     * Add optional GPU information that may not be available on all GPUs.
     *
     * @param array<int, array> $gpus
     * @return array<int, array>
     */
    protected function addOptionalGpuInfo(array $gpus): array
    {
        // Try to get clock information
        $clockProcess = new Process([
            self::NVIDIA_SMI,
            '--query-gpu=clocks.applications.sm,clocks.applications.memory',
            '--format=csv,noheader,nounits',
        ]);
        $clockProcess->run();

        if ($clockProcess->isSuccessful()) {
            $clockOutput = trim($clockProcess->getOutput());
            $clockLines = explode("\n", $clockOutput);

            foreach ($gpus as $index => &$gpu) {
                if (isset($clockLines[$index])) {
                    $clockFields = array_map('trim', explode(',', $clockLines[$index]));
                    if (count($clockFields) >= 2) {
                        $gpu['clock_sm'] = (int) $clockFields[0];
                        $gpu['clock_memory'] = (int) $clockFields[1];
                    }
                }
            }
        }

        // Try to get VBIOS version
        $vbiosProcess = new Process([
            self::NVIDIA_SMI,
            '--query-gpu=vbios_version',
            '--format=csv,noheader',
        ]);
        $vbiosProcess->run();

        if ($vbiosProcess->isSuccessful()) {
            $vbiosOutput = trim($vbiosProcess->getOutput());
            $vbiosLines = explode("\n", $vbiosOutput);

            foreach ($gpus as $index => &$gpu) {
                if (isset($vbiosLines[$index])) {
                    $gpu['vbios_version'] = trim($vbiosLines[$index]);
                }
            }
        }

        return $gpus;
    }

    /**
     * Get detailed information about a specific GPU by index.
     *
     * @return array{
     *     index: int,
     *     name: string,
     *     uuid: string,
     *     memory_total: int,
     *     memory_used: int,
     *     memory_free: int,
     *     utilization_gpu: int,
     *     utilization_memory: int,
     *     temperature: int,
     *     power_draw: float,
     *     power_limit: float,
     *     clock_sm: int,
     *     clock_memory: int,
     *     driver: string,
     *     cuda_version: string,
     *     vbios_version: string,
     *     persistence_mode: bool,
     *     ecc_enabled: bool,
     * }|null
     */
    public function getGpuInfo(int $index): ?array
    {
        $gpus = $this->listGpus();

        foreach ($gpus as $gpu) {
            if ($gpu['index'] === $index) {
                return $gpu;
            }
        }

        return null;
    }

    /**
     * Get CUDA version from nvidia-smi.
     */
    protected function getCudaVersion(): string
    {
        $process = new Process([
            self::NVIDIA_SMI,
            '--query-gpu=compute_cap',
            '--format=csv,noheader',
        ]);
        $process->run();

        if (!$process->isSuccessful()) {
            return 'Unknown';
        }

        $output = trim($process->getOutput());
        $lines = explode("\n", $output);

        if (empty($lines)) {
            return 'Unknown';
        }

        // Convert compute capability to CUDA version (approximate)
        $computeCap = trim($lines[0]);
        $parts = explode('.', $computeCap);

        if (count($parts) >= 2) {
            $major = (int) $parts[0];
            $minor = (int) $parts[1];

            // CUDA version mapping based on compute capability
            // This is an approximation
            return match ($major) {
                8 => '11.0',
                7 => '11.0',
                6 => '9.0',
                5 => '8.0',
                default => "Compute {$computeCap}",
            };
        }

        return 'Unknown';
    }
}
