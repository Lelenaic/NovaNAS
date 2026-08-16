<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;

class MonitorController extends Controller
{
    public function __construct() {}

    /**
     * Create a new monitor session running btop.
     */
    public function createSession(Request $request)
    {
        $user = $request->user();

        if (! $user->username) {
            Log::warning('No Linux user bound', ['user_id' => $user->id]);

            return response()->json(['error' => 'No Linux user bound to your account'], 400);
        }

        $port = $this->findFreePort();

        $sessionId = Str::uuid()->toString();

        $tmuxSession = "monitor-{$sessionId}";
        $cleanupCmd = base_path('artisan')." session:cleanup --type=monitor --session-id={$sessionId}";
        $command = [
            'sudo', 'su', '-', $user->username, '-c',
            "tmux new-session -d -s {$tmuxSession} bash -c '/usr/local/bin/ttyd -p {$port} -i 127.0.0.1 --once -s SIGHUP -W -o -H X-Terminal-User btop ; {$cleanupCmd}'",
        ];

        $result = Process::timeout(10)->run($command);

        if ($result->failed()) {
            Log::error('Failed to start monitor session', ['error' => $result->errorOutput()]);

            return response()->json(['error' => 'Failed to start monitor: '.$result->errorOutput()], 500);
        }

        $this->writeApacheConfig($sessionId, $port);

        Cache::put("monitor_session_{$sessionId}", [
            'port' => $port,
            'user_id' => $user->id,
            'tmux_session' => $tmuxSession,
            'created_at' => now(),
        ], now()->addHours(24));

        return response()->json([
            'session_id' => $sessionId,
            'url' => "/terminal/{$sessionId}/",
        ]);
    }

    /**
     * Destroy a monitor session.
     */
    public function destroySession(Request $request, string $sessionId)
    {
        $session = Cache::get("monitor_session_{$sessionId}");

        if (! $session) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        Process::run(['sudo', 'tmux', 'kill-session', '-t', $session['tmux_session']]);

        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";
        Process::run(['sudo', 'a2disconf', "terminal-{$sessionId}"]);
        Process::run(['sudo', 'rm', '-f', $configPath]);
        Process::run(['sudo', 'systemctl', 'reload', 'apache2']);

        Cache::forget("monitor_session_{$sessionId}");

        return response()->json(['success' => true]);
    }

    /**
     * Find a free port in range 10000-65535.
     */
    private function findFreePort(): ?int
    {
        for ($port = 10000; $port <= 65535; $port++) {
            $result = Process::timeout(5)->run(['ss', '-tuln']);

            if ($result->successful()) {
                $output = $result->output();
                if (strpos($output, ":{$port} ") === false) {
                    return $port;
                }
            }
        }

        return null;
    }

    /**
     * Write Apache config for the monitor session.
     */
    private function writeApacheConfig(string $sessionId, int $port): void
    {
        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";

        $config = "<Location \"/terminal/{$sessionId}/\">\n";
        $config .= "    ProxyPass http://127.0.0.1:{$port}/ upgrade=websocket\n";
        $config .= "    ProxyPassReverse http://127.0.0.1:{$port}/\n";
        $config .= "    RequestHeader set X-Terminal-User \"authenticated\"\n";
        $config .= "</Location>\n";

        $result = Process::run(['sudo', 'bash', '-c', "echo '$config' > $configPath"]);

        if ($result->failed()) {
            throw new \RuntimeException('Failed to write Apache config');
        }

        $result = Process::run(['sudo', 'a2enconf', "terminal-{$sessionId}"]);

        if ($result->failed()) {
            throw new \RuntimeException('Failed to enable Apache config');
        }

        $result = Process::run(['sudo', 'apache2ctl', 'configtest']);

        if ($result->failed()) {
            throw new \RuntimeException('Apache config test failed: '.$result->errorOutput());
        }

        $result = Process::run(['sudo', 'systemctl', 'reload', 'apache2']);

        if ($result->failed()) {
            throw new \RuntimeException('Failed to reload Apache');
        }
    }
}
