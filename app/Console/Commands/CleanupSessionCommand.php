<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

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
        $process = new Process(['sudo', 'tmux', 'kill-session', '-t', $tmuxSession]);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->warn("Failed to kill tmux session: {$process->getErrorOutput()}");
        }
    }

    private function removeApacheConfig(string $sessionId): void
    {
        $configPath = "/etc/apache2/conf-available/terminal-{$sessionId}.conf";

        (new Process(['sudo', 'a2disconf', "terminal-{$sessionId}"]))->run();
        (new Process(['sudo', 'rm', '-f', $configPath]))->run();
    }

    private function reloadApache(): void
    {
        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->warn('Failed to reload Apache: '.$process->getErrorOutput());
        }
    }
}
