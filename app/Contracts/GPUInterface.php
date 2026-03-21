<?php

namespace App\Contracts;

/**
 * Interface for GPU providers.
 *
 * Each provider must implement this interface to be supported by the GPU system.
 * This allows for extensible support for different GPU vendors (NVIDIA, AMD, Intel, etc.).
 */
interface GPUInterface
{
    /**
     * Get the provider name/identifier.
     */
    public function getProviderName(): string;

    /**
     * Get the display name for the provider.
     */
    public function getDisplayName(): string;

    /**
     * Check if the GPU driver is installed.
     */
    public function isDriverInstalled(): bool;

    /**
     * Get the driver version if installed.
     */
    public function getDriverVersion(): ?string;

    /**
     * List all available GPUs with their details.
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
     *     clock_sm: int,
     *     clock_memory: int,
     *     driver: string,
     *     cuda_version: string,
     *     vbios_version: string,
     *     persistence_mode: bool,
     *     ecc_enabled: bool,
     * }>
     */
    public function listGpus(): array;

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
    public function getGpuInfo(int $index): ?array;
}
