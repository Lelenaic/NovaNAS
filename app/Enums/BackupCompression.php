<?php

namespace App\Enums;

enum BackupCompression: string
{
    case Auto = 'auto';
    case Off = 'off';
    case Fastest = 'fastest';
    case Better = 'better';
    case Max = 'max';

    /**
     * Get the display label for the compression level.
     */
    public function label(): string
    {
        return match ($this) {
            self::Auto => 'Auto (Recommended)',
            self::Off => 'Off',
            self::Fastest => 'Fastest',
            self::Better => 'Better',
            self::Max => 'Maximum',
        };
    }
}
