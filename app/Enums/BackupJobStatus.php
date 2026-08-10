<?php

namespace App\Enums;

enum BackupJobStatus: string
{
    case Idle = 'idle';
    case Running = 'running';
    case Failed = 'failed';
    case Success = 'success';

    /**
     * Get the display label for the status.
     */
    public function label(): string
    {
        return match ($this) {
            self::Idle => 'Idle',
            self::Running => 'Running',
            self::Failed => 'Failed',
            self::Success => 'Success',
        };
    }

    /**
     * Get the Mantine color for the status badge.
     */
    public function color(): string
    {
        return match ($this) {
            self::Idle => 'gray',
            self::Running => 'blue',
            self::Failed => 'red',
            self::Success => 'green',
        };
    }
}
