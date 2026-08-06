<?php

namespace App\Services;

use Symfony\Component\Process\Process;

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
        'nut' => [
            'name' => 'NUT (UPS)',
            'description' => 'Network UPS Tools - monitor and manage UPS devices for automatic shutdown',
        ],
    ];

    /**
     * Mapping of composite service IDs to their underlying systemd services.
     *
     * @var array<string, list<string>>
     */
    protected const COMPOSITE_SERVICES = [
        'nut' => ['nut-server', 'nut-monitor'],
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
        $systemdNames = self::COMPOSITE_SERVICES[$serviceName] ?? [$serviceName];

        foreach ($systemdNames as $systemdName) {
            $process = new Process(['sudo', 'systemctl', 'is-enabled', $systemdName]);
            $process->run();

            if (! $process->isSuccessful() || trim($process->getOutput()) !== 'enabled') {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if a service is currently active/running.
     */
    public function isActive(string $serviceName): bool
    {
        $systemdNames = self::COMPOSITE_SERVICES[$serviceName] ?? [$serviceName];

        foreach ($systemdNames as $systemdName) {
            $process = new Process(['sudo', 'systemctl', 'is-active', $systemdName]);
            $process->run();

            if (! $process->isSuccessful() || trim($process->getOutput()) !== 'active') {
                return false;
            }
        }

        return true;
    }

    /**
     * Enable or disable a service.
     *
     * @param  string  $serviceId  The service ID (key from SERVICES array)
     * @param  bool  $enabled  True to enable, false to disable
     *
     * @throws \InvalidArgumentException
     * @throws \RuntimeException
     */
    public function setEnabled(string $serviceId, bool $enabled): bool
    {
        if (! isset(self::SERVICES[$serviceId])) {
            throw new \InvalidArgumentException("Unknown service: {$serviceId}");
        }

        $action = $enabled ? 'enable' : 'disable';
        $systemdNames = self::COMPOSITE_SERVICES[$serviceId] ?? [$serviceId];

        foreach ($systemdNames as $systemdName) {
            $process = new Process(['sudo', 'systemctl', $action, '--now', $systemdName]);
            $process->run();

            if (! $process->isSuccessful()) {
                throw new \RuntimeException(
                    "Failed to {$action} ".self::SERVICES[$serviceId]['name'].': '.$process->getErrorOutput()
                );
            }
        }

        return true;
    }

    /**
     * Get service configuration details.
     */
    public function getServiceConfig(string $serviceId): ?array
    {
        if (! isset(self::SERVICES[$serviceId])) {
            return null;
        }

        return self::SERVICES[$serviceId];
    }
}
