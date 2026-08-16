<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class CleanupSessionCommand extends Command
{
    protected $signature = 'session:cleanup
                            {--type= : Session type (terminal or monitor)}
                            {--session-id= : The session UUID}';

    protected $description = 'Clean up terminal/monitor session resources (tmux, Apache config, cache)';

    public function handle(): int
    {
        $type = $this->option('type');
        $sessionId = $this->option('session-id');

        if (! $type || ! $sessionId) {
            $this->error('Usage: php artisan session:cleanup --type=terminal --session-id=<uuid>');

            return self::FAILURE;
        }

        if (! in_array($type, ['terminal', 'monitor'])) {
            $this->error("Invalid type: {$type}. Must be 'terminal' or 'monitor'.");

            return self::FAILURE;
        }

        $cacheKey = "{$type}_session_{$sessionId}";
        $session = Cache::get($cacheKey);

        if (! $session) {
            $this->info("Session {$sessionId} not found in cache (already cleaned up?).");
            $this->removeApacheConfig($sessionId);

            return self::SUCCESS;
        }

        $this->info("Cleaning up {$type} session: {$sessionId}");

        $this->killTmuxSession($session['tmux_session']);
        $this->removeApacheConfig($sessionId);
        $this->reloadApache();

        Cache::forget($cacheKey);

        $this->info("Session {$sessionId} cleaned up successfully.");

        Log::info('Session cleanup completed', [
            'type' => $type,
            'session_id' => $sessionId,
        ]);

        return self::SUCCESS;
    }

    private function killTmuxSession(string $tmuxSession): void
    {
        $result = Process::run(['sudo', 'tmux', 'kill-session', '-t', $tmuxSession]);

        if ($result->failed()) {
            $this->warn("Failed to kill tmux session: {$result->errorOutput()}");
        }
    }

    private function removeApacheConfig(string $sessionId): void
    {
        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";

        Process::run(['sudo', 'a2disconf', "terminal-{$sessionId}"]);
        Process::run(['sudo', 'rm', '-f', $configPath]);
    }

    private function reloadApache(): void
    {
        $result = Process::run(['sudo', 'systemctl', 'reload', 'apache2']);

        if ($result->failed()) {
            $this->warn('Failed to reload Apache: '.$result->errorOutput());
        }
    }
}
