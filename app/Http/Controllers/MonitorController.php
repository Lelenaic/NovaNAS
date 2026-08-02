<?php

namespace App\Http\Controllers;

use App\Services\LinuxUserService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class MonitorController extends Controller
{
    public function __construct(
        private LinuxUserService $linuxUserService
    ) {}

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
        $command = [
            'sudo', 'su', '-', $user->username, '-c', "tmux new-session -d -s {$tmuxSession} /usr/local/bin/ttyd -p {$port} -i 127.0.0.1 --once -W -o -H X-Terminal-User btop",
        ];

        $process = new Process($command);
        $process->setTimeout(10);
        $process->run();

        if (! $process->isSuccessful()) {
            Log::error('Failed to start monitor session', ['error' => $process->getErrorOutput()]);

            return response()->json(['error' => 'Failed to start monitor: '.$process->getErrorOutput()], 500);
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

        $process = new Process(['sudo', 'tmux', 'kill-session', '-t', $session['tmux_session']]);
        $process->run();

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
            $process = new Process(['ss', '-tuln']);
            $process->setTimeout(5);
            $process->run();

            if ($process->isSuccessful()) {
                $output = $process->getOutput();
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

        $process = new Process(['sudo', 'bash', '-c', "echo '$config' > $configPath"]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to write Apache config');
        }

        $process = new Process(['sudo', 'a2enconf', "terminal-{$sessionId}"]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to enable Apache config');
        }

        $process = new Process(['sudo', 'apache2ctl', 'configtest']);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Apache config test failed: '.$process->getErrorOutput());
        }

        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to reload Apache');
        }
    }
}
