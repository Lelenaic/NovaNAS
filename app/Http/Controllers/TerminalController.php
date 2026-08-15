<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

class TerminalController extends Controller
{
    public function __construct() {}

    /**
     * Create a new terminal session.
     */
    public function createSession(Request $request)
    {
        $user = $request->user();

        if (! $user->username) {
            Log::warning('No Linux user bound', ['user_id' => $user->id]);

            return response()->json(['error' => 'No Linux user bound to your account'], 400);
        }

        // Use fixed port for testing
        $port = $this->findFreePort();

        // Generate session ID
        $sessionId = Str::uuid()->toString();

        // Start ttyd in tmux — wrap in bash -c so the cleanup runs INSIDE the tmux session
        // after ttyd exits (tmux new-session -d returns immediately, so ; cleanup would run instantly)
        $tmuxSession = "ttyd-{$sessionId}";
        $cleanupCmd = base_path('artisan')." session:cleanup --type=terminal --session-id={$sessionId}";
        $command = [
            'sudo', 'su', '-', $user->username, '-c',
            "tmux new-session -d -s {$tmuxSession} bash -c '/usr/local/bin/ttyd -p {$port} -i 127.0.0.1 --exit-no-conn -s SIGHUP -W -o -H X-Terminal-User /bin/bash ; {$cleanupCmd}'",
        ];

        $process = new Process($command);
        $process->setTimeout(10); // 10 seconds timeout
        $process->run();

        if (! $process->isSuccessful()) {
            Log::error('Failed to start ttyd', ['error' => $process->getErrorOutput()]);

            return response()->json(['error' => 'Failed to start terminal: '.$process->getErrorOutput()], 500);
        }

        $this->writeApacheConfig($sessionId, $port);

        // Store session info (in cache, expires in 24 hours)
        Cache::put("terminal_session_{$sessionId}", [
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
     * Destroy a terminal session.
     */
    public function destroySession(Request $request, string $sessionId)
    {
        $session = Cache::get("terminal_session_{$sessionId}");

        if (! $session) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        $process = new Process(['sudo', 'tmux', 'kill-session', '-t', $session['tmux_session']]);
        $process->run();

        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";
        (new Process(['sudo', 'a2disconf', "terminal-{$sessionId}"]))->run();
        (new Process(['sudo', 'rm', '-f', $configPath]))->run();
        (new Process(['sudo', 'systemctl', 'reload', 'apache2']))->run();

        Cache::forget("terminal_session_{$sessionId}");

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
     * Write Apache config for the terminal session.
     */
    private function writeApacheConfig(string $sessionId, int $port): void
    {
        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";

        $config = "<Location \"/terminal/{$sessionId}/\">\n";
        $config .= "    ProxyPass http://127.0.0.1:{$port}/ upgrade=websocket\n";
        $config .= "    ProxyPassReverse http://127.0.0.1:{$port}/\n";
        $config .= "    RequestHeader set X-Terminal-User \"authenticated\"\n";
        $config .= "</Location>\n";

        // Write config with sudo
        $process = new Process(['sudo', 'bash', '-c', "echo '$config' > $configPath"]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to write Apache config');
        }

        // Enable the conf
        $process = new Process(['sudo', 'a2enconf', "terminal-{$sessionId}"]);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to enable Apache config');
        }

        // Check config
        $process = new Process(['sudo', 'apache2ctl', 'configtest']);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Apache config test failed: '.$process->getErrorOutput());
        }

        // Reload Apache
        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            throw new \RuntimeException('Failed to reload Apache');
        }
    }
}
