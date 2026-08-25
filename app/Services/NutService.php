<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

/**
 * NUT (Network UPS Tools) Service
 *
 * Manages UPS detection, status monitoring, and shutdown configuration.
 */
class NutService
{
    /**
     * The NUT device name used in ups.conf and upsc commands.
     */
    private const NUT_DEVICE_NAME = 'nas-ups';

    private const SETTING_KEYS = [
        'selected_device' => 'ups.selected_device',
        'shutdown_mode' => 'ups.shutdown_mode',
        'shutdown_battery_pct' => 'ups.shutdown_battery_pct',
        'shutdown_minutes' => 'ups.shutdown_minutes',
        'cancel_on_power_return' => 'ups.cancel_on_power_return',
    ];

    /**
     * Detect connected USB UPS devices using nut-scanner.
     *
     * @return array<int, array{
     *     id: string,
     *     driver: string,
     *     vendor: string,
     *     product: string,
     *     serial: string,
     *     vendorid: string,
     *     productid: string,
     * }>
     */
    public function detectDevices(): array
    {
        $process = Process::run('sudo nut-scanner -U 2>/dev/null');

        if (! $process->successful()) {
            Log::warning('nut-scanner failed', [
                'error' => $process->errorOutput(),
            ]);

            return [];
        }

        return $this->parseNutScannerOutput($process->output());
    }

    /**
     * Get status variables for the configured UPS device via upsc.
     *
     * @return array<string, string>
     */
    public function getDeviceStatus(): array
    {
        $process = Process::run('sudo upsc '.self::NUT_DEVICE_NAME.' 2>/dev/null');

        if (! $process->successful()) {
            return [];
        }

        return $this->parseUpcOutput($process->output());
    }

    /**
     * Get the currently selected UPS device name.
     */
    public function getSelectedDevice(): ?string
    {
        return Setting::getValue(self::SETTING_KEYS['selected_device']);
    }

    /**
     * Get the full UPS configuration.
     *
     * @return array{
     *     selected_device: string|null,
     *     shutdown_mode: string,
     *     shutdown_battery_pct: int,
     *     shutdown_minutes: int,
     *     cancel_on_power_return: bool,
     * }
     */
    public function getConfig(): array
    {
        $settings = Setting::getMultiple(array_values(self::SETTING_KEYS));

        return [
            'selected_device' => $settings[self::SETTING_KEYS['selected_device']] ?: null,
            'shutdown_mode' => $settings[self::SETTING_KEYS['shutdown_mode']] ?? 'battery',
            'shutdown_battery_pct' => (int) ($settings[self::SETTING_KEYS['shutdown_battery_pct']] ?? 15),
            'shutdown_minutes' => (int) ($settings[self::SETTING_KEYS['shutdown_minutes']] ?? 5),
            'cancel_on_power_return' => ($settings[self::SETTING_KEYS['cancel_on_power_return']] ?? '1') === '1',
        ];
    }

    /**
     * Save the UPS configuration.
     *
     * @param  array<string, mixed>  $config
     */
    public function saveConfig(array $config): void
    {
        if (array_key_exists('selected_device', $config)) {
            Setting::setValue(self::SETTING_KEYS['selected_device'], $config['selected_device']);
        }

        if (array_key_exists('shutdown_mode', $config)) {
            Setting::setValue(self::SETTING_KEYS['shutdown_mode'], $config['shutdown_mode']);
        }

        if (array_key_exists('shutdown_battery_pct', $config)) {
            Setting::setValue(self::SETTING_KEYS['shutdown_battery_pct'], (string) $config['shutdown_battery_pct']);
        }

        if (array_key_exists('shutdown_minutes', $config)) {
            Setting::setValue(self::SETTING_KEYS['shutdown_minutes'], (string) $config['shutdown_minutes']);
        }

        if (array_key_exists('cancel_on_power_return', $config)) {
            Setting::setValue(self::SETTING_KEYS['cancel_on_power_return'], $config['cancel_on_power_return'] ? '1' : '0');
        }
    }

    /**
     * Apply the current UPS configuration to NUT config files and restart services.
     */
    public function applyConfig(): array
    {
        $config = $this->getConfig();
        $selectedDevice = $config['selected_device'];

        if ($selectedDevice === null) {
            return ['success' => false, 'message' => 'No UPS device selected.'];
        }

        // Write ups.conf with the selected device (only dynamic config)
        $detected = $this->detectDevices();
        $deviceInfo = collect($detected)->firstWhere('id', $selectedDevice);

        if (! $deviceInfo) {
            return ['success' => false, 'message' => 'Selected UPS device not found. It may have been disconnected.'];
        }

        $this->writeUpsConf($deviceInfo);

        // Write shutdown config
        $this->writeShutdownConfig($config);

        // Restart NUT services
        $restartResult = $this->restartNutServices();

        if (! $restartResult['success']) {
            return $restartResult;
        }

        return ['success' => true, 'message' => 'UPS configuration applied successfully.'];
    }

    /**
     * Check if NUT services are running and enabled.
     *
     * @return array{enabled: bool, active: bool}
     */
    public function getServiceStatus(): array
    {
        $systemdServices = ['nut-server', 'nut-monitor'];
        $enabled = true;
        $active = true;

        foreach ($systemdServices as $service) {
            $enabledResult = Process::run("systemctl is-enabled {$service} 2>/dev/null");
            if (trim($enabledResult->output()) !== 'enabled') {
                $enabled = false;
            }

            $activeResult = Process::run("systemctl is-active {$service} 2>/dev/null");
            if (trim($activeResult->output()) !== 'active') {
                $active = false;
            }
        }

        return ['enabled' => $enabled, 'active' => $active];
    }

    /**
     * Write /etc/nut/ups.conf with the detected UPS device.
     *
     * @param  array<string, string>  $deviceInfo
     */
    private function writeUpsConf(array $deviceInfo): void
    {
        $content = <<<'CONF'
# NovaNAS UPS Configuration - Auto-generated
maxretry = 3

[nas-ups]
	driver = DRIVER_PLACEHOLDER
	port = auto
	vendorid = VENDORID_PLACEHOLDER
	productid = PRODUCTID_PLACEHOLDER
	desc = "NovaNAS UPS"
CONF;

        $content = str_replace('DRIVER_PLACEHOLDER', $deviceInfo['driver'], $content);
        $content = str_replace('VENDORID_PLACEHOLDER', $deviceInfo['vendorid'], $content);
        $content = str_replace('PRODUCTID_PLACEHOLDER', $deviceInfo['productid'], $content);

        $process = Process::run('echo '.escapeshellarg($content).' | sudo tee /etc/nut/ups.conf > /dev/null');

        if (! $process->successful()) {
            Log::error('Failed to write ups.conf', ['error' => $process->errorOutput()]);
        }
    }

    /**
     * Restart NUT services in the correct order: udev, driver, server, monitor.
     *
     * @return array{success: bool, message: string}
     */
    private function restartNutServices(): array
    {
        // Reload udev rules so the driver can access the USB device
        Process::run('sudo udevadm control --reload-rules 2>/dev/null');
        Process::run('sudo udevadm trigger 2>/dev/null');
        usleep(500_000);

        // Stop everything first (ignore errors if not running)
        Process::run('sudo systemctl stop nut-monitor 2>/dev/null');
        Process::run('sudo systemctl stop nut-server 2>/dev/null');
        Process::run("sudo systemctl stop 'nut-driver@nas-ups' 2>/dev/null");

        // Start the driver first — it talks to the USB device
        $driverStart = Process::run("sudo systemctl start 'nut-driver@nas-ups' 2>&1");

        if (! $driverStart->successful()) {
            return [
                'success' => false,
                'message' => 'Failed to start NUT driver: '.trim($driverStart->errorOutput()),
            ];
        }

        // Wait for driver to connect to the UPS
        usleep(2_000_000);

        // Start nut-server
        $serverStart = Process::run('sudo systemctl start nut-server 2>&1');

        if (! $serverStart->successful()) {
            return [
                'success' => false,
                'message' => 'Failed to start NUT server: '.trim($serverStart->errorOutput()),
            ];
        }

        // Wait for server to initialize
        usleep(500_000);

        // Start nut-monitor
        $monitorStart = Process::run('sudo systemctl start nut-monitor 2>&1');

        if (! $monitorStart->successful()) {
            return [
                'success' => false,
                'message' => 'Failed to start NUT monitor: '.trim($monitorStart->errorOutput()),
            ];
        }

        return ['success' => true, 'message' => 'NUT services restarted successfully.'];
    }

    /**
     * Write the shutdown configuration file for the monitor script.
     *
     * @param  array<string, mixed>  $config
     */
    private function writeShutdownConfig(array $config): void
    {
        $lines = [
            '# NovaNAS UPS Shutdown Configuration - Auto-generated',
            'SHUTDOWN_MODE='.$config['shutdown_mode'],
            'BATTERY_THRESHOLD='.$config['shutdown_battery_pct'],
            'SHUTDOWN_MINUTES='.$config['shutdown_minutes'],
            'CANCEL_ON_POWER_RETURN='.($config['cancel_on_power_return'] ? '1' : '0'),
            'UPS_NAME='.self::NUT_DEVICE_NAME,
        ];

        $content = implode("\n", $lines)."\n";
        $process = Process::run('echo '.escapeshellarg($content).' | sudo tee /etc/nut/nova-shutdown.conf > /dev/null');

        if (! $process->successful()) {
            Log::error('Failed to write nova-shutdown.conf', ['error' => $process->errorOutput()]);
        }
    }

    /**
     * Parse nut-scanner -U output into structured device data.
     *
     * @return array<int, array{
     *     id: string,
     *     driver: string,
     *     vendor: string,
     *     product: string,
     *     serial: string,
     *     vendorid: string,
     *     productid: string,
     * }>
     */
    private function parseNutScannerOutput(string $output): array
    {
        $devices = [];
        $currentDevice = null;

        $lines = explode("\n", $output);

        foreach ($lines as $line) {
            $line = trim($line);

            // Match device section header: [nutdev1]
            if (preg_match('/^\[(\w+)\]$/', $line, $matches)) {
                if ($currentDevice !== null) {
                    $devices[] = $currentDevice;
                }
                $currentDevice = [
                    'id' => $matches[1],
                    'driver' => '',
                    'vendor' => '',
                    'product' => '',
                    'serial' => '',
                    'vendorid' => '',
                    'productid' => '',
                ];

                continue;
            }

            // Skip lines outside device sections or the ###NOTMATCHED### lines
            if ($currentDevice === null || str_contains($line, '###NOTMATCHED')) {
                continue;
            }

            // Parse key = "value" pairs
            if (preg_match('/^(\w+)\s*=\s*"?(.+?)"?\s*$/', $line, $matches)) {
                $key = strtolower($matches[1]);
                $value = trim($matches[2], '" ');

                if (isset($currentDevice[$key])) {
                    $currentDevice[$key] = $value;
                }
            }
        }

        // Don't forget the last device
        if ($currentDevice !== null) {
            $devices[] = $currentDevice;
        }

        return $devices;
    }

    /**
     * Parse upsc output into key-value pairs.
     *
     * @return array<string, string>
     */
    private function parseUpcOutput(string $output): array
    {
        $variables = [];

        $lines = explode("\n", $output);

        foreach ($lines as $line) {
            $line = trim($line);

            if ($line === '' || ! str_contains($line, ':')) {
                continue;
            }

            [$key, $value] = explode(':', $line, 2);

            $variables[trim($key)] = trim($value);
        }

        return $variables;
    }
}
