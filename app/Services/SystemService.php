<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

/**
 * System Service Manager
 *
 * Provides methods for managing systemd services (enable, disable, status).
 */
class SystemService
{
    /**
     * List of available services to manage.
     * Key is the ID used in UI and also the systemd service name.
     *
     * @var array<string, array{name: string, description: string}>
     */
    protected const SERVICES = [
        'ssh' => [
            'name' => 'SSH',
            'description' => 'Secure Shell server for remote access',
        ],
        'smbd' => [
            'name' => 'Samba',
            'description' => 'Windows file sharing (SMB/CIFS)',
        ],
    ];

    /**
     * Get all available services with their status.
     *
     * @return array<int, array{id: string, name: string, description: string, enabled: bool, active: bool}>
     */
    public function getServices(): array
    {
        $services = [];

        foreach (self::SERVICES as $id => $service) {
            $services[] = [
                'id' => $id,
                'name' => $service['name'],
                'description' => $service['description'],
                'enabled' => $this->isEnabled($id),
                'active' => $this->isActive($id),
            ];
        }

        return $services;
    }

    /**
     * Check if a service is enabled (will start on boot).
     */
    public function isEnabled(string $serviceName): bool
    {
        $process = new Process(['sudo', 'systemctl', 'is-enabled', $serviceName]);
        $process->run();

        if (!$process->isSuccessful()) {
            return false;
        }

        $output = trim($process->getOutput());

        // is-enabled returns "enabled", "disabled", "masked", or error
        return $output === 'enabled';
    }

    /**
     * Check if a service is currently active/running.
     */
    public function isActive(string $serviceName): bool
    {
        $process = new Process(['sudo', 'systemctl', 'is-active', $serviceName]);
        $process->run();

        if (!$process->isSuccessful()) {
            return false;
        }

        $output = trim($process->getOutput());

        // is-active returns "active", "inactive", "failed", etc.
        return $output === 'active';
    }

    /**
     * Enable or disable a service.
     *
     * @param string $serviceId The service ID (key from SERVICES array)
     * @param bool $enabled True to enable, false to disable
     * @return bool
     * @throws \InvalidArgumentException
     * @throws \RuntimeException
     */
    public function setEnabled(string $serviceId, bool $enabled): bool
    {
        if (!isset(self::SERVICES[$serviceId])) {
            throw new \InvalidArgumentException("Unknown service: {$serviceId}");
        }

        $action = $enabled ? 'enable' : 'disable';

        // Enable/disable and start/stop the service (--now flag applies immediately)
        $process = new Process(['sudo', 'systemctl', $action, '--now', $serviceId]);
        $process->run();

        if (!$process->isSuccessful()) {
            throw new \RuntimeException(
                "Failed to {$action} " . self::SERVICES[$serviceId]['name'] . ": " . $process->getErrorOutput()
            );
        }

        return true;
    }

    /**
     * Get service configuration details.
     */
    public function getServiceConfig(string $serviceId): ?array
    {
        if (!isset(self::SERVICES[$serviceId])) {
            return null;
        }

        return self::SERVICES[$serviceId];
    }
}
