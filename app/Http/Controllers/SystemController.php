<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;

class SystemController extends Controller
{
    /**
     * Get system information including date/time from the OS.
     */
    public function info(): JsonResponse
    {
        // Get system date/time from the OS
        $dateTime = now()->format('Y-m-d H:i:s');

        // Get additional system info
        $uptime = $this->getUptime();
        $loadAverage = $this->getLoadAverage();
        $cpuUsage = $this->getCpuUsage();
        $memoryUsage = $this->getMemoryUsage();

        return response()->json([
            'datetime' => $dateTime,
            'timestamp' => now()->timestamp,
            'timezone' => config('app.timezone'),
            'uptime' => $uptime,
            'load_average' => $loadAverage,
            'cpu_usage' => $cpuUsage,
            'memory_usage' => $memoryUsage,
        ]);
    }

    /**
     * Get system uptime.
     */
    protected function getUptime(): ?string
    {
        if (File::exists('/proc/uptime')) {
            $uptime = trim(File::get('/proc/uptime'));
            $uptimeSeconds = explode(' ', $uptime)[0];

            $days = floor($uptimeSeconds / 86400);
            $hours = floor(($uptimeSeconds % 86400) / 3600);
            $minutes = floor(($uptimeSeconds % 3600) / 60);

            return "{$days}d {$hours}h {$minutes}m";
        }

        return null;
    }

    /**
     * Get system load average.
     */
    protected function getLoadAverage(): ?array
    {
        if (File::exists('/proc/loadavg')) {
            $load = explode(' ', trim(File::get('/proc/loadavg')));

            return [
                '1min' => (float) $load[0],
                '5min' => (float) $load[1],
                '15min' => (float) $load[2],
            ];
        }

        return null;
    }

    /**
     * Get CPU usage percentage.
     */
    protected function getCpuUsage(): ?array
    {
        if (File::exists('/proc/stat')) {
            $stat = File::get('/proc/stat');
            preg_match('/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/', $stat, $matches);

            if ($matches) {
                $user = (int) $matches[1];
                $nice = (int) $matches[2];
                $system = (int) $matches[3];
                $idle = (int) $matches[4];
                $iowait = (int) $matches[5];
                $irq = (int) $matches[6];
                $softirq = (int) $matches[7];

                $total = $user + $nice + $system + $idle + $iowait + $irq + $softirq;
                $used = $total - $idle - $iowait;

                if ($total > 0) {
                    return [
                        'used' => $used,
                        'total' => $total,
                        'percentage' => round(($used / $total) * 100, 1),
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Get memory usage.
     */
    protected function getMemoryUsage(): ?array
    {
        // Try using 'free -b' command first (more reliable in containers)
        $freeOutput = shell_exec('free -b 2>/dev/null');

        if ($freeOutput) {
            $lines = explode("\n", trim($freeOutput));

            // Parse "Mem:" line (format: total used free shared buff/cache available)
            if (isset($lines[1])) {
                $parts = preg_split('/\s+/', $lines[1]);

                if (count($parts) >= 3) {
                    $total = (int) $parts[1];
                    $used = (int) $parts[2];
                    $free = (int) $parts[3];

                    // If available is present (newer free versions), use it
                    if (count($parts) >= 7) {
                        $available = (int) $parts[6];
                        $used = $total - $available;
                    }

                    if ($total > 0) {
                        return [
                            'total' => $total,
                            'available' => $total - $used,
                            'used' => $used,
                            'percentage' => round(($used / $total) * 100, 1),
                        ];
                    }
                }
            }
        }

        // Fallback to /proc/meminfo parsing
        if (File::exists('/proc/meminfo')) {
            $meminfo = File::get('/proc/meminfo');

            // Try to match MemTotal and MemAvailable (modern kernels)
            preg_match('/^MemTotal:\s+(\d+)/', $meminfo, $total);
            preg_match('/^MemAvailable:\s+(\d+)/', $meminfo, $available);

            $totalKb = isset($total[1]) ? (int) $total[1] : 0;

            // If MemAvailable is not available or is 0, fall back to MemFree + Buffers + Cached (older kernels)
            if (empty($available) || (int) $available[1] === 0) {
                preg_match('/^MemFree:\s+(\d+)/', $meminfo, $free);
                preg_match('/^Buffers:\s+(\d+)/', $meminfo, $buffers);
                preg_match('/^Cached:\s+(\d+)/', $meminfo, $cached);

                $freeKb = isset($free[1]) ? (int) $free[1] : 0;
                $buffersKb = isset($buffers[1]) ? (int) $buffers[1] : 0;
                $cachedKb = isset($cached[1]) ? (int) $cached[1] : 0;
                $availableKb = $freeKb + $buffersKb + $cachedKb;
            } else {
                $availableKb = (int) $available[1];
            }

            if ($totalKb > 0) {
                $usedKb = $totalKb - $availableKb;

                return [
                    'total' => $totalKb * 1024,
                    'available' => $availableKb * 1024,
                    'used' => $usedKb * 1024,
                    'percentage' => round(($usedKb / $totalKb) * 100, 1),
                ];
            }
        }

        return null;
    }
}
