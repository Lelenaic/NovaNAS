<?php

namespace App\Enums;

enum BackupStorageType: string
{
    case Local = 'local';
    case Sftp = 'sftp';
    case S3 = 's3';
    case NovaNasBackup = 'novanas_backup';

    /**
     * Get the display name for the storage type.
     */
    public function label(): string
    {
        return match ($this) {
            self::Local => 'Local Directory',
            self::Sftp => 'SFTP (SSH)',
            self::S3 => 'S3-Compatible Storage',
            self::NovaNasBackup => 'NovaNAS Backup Server',
        };
    }

    /**
     * Get the storage type from a string value.
     */
    public static function fromValue(string $value): self
    {
        return self::tryFrom($value) ?? self::Local;
    }
}
