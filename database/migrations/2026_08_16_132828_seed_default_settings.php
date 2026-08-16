<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Default settings values. Never fall back to these in application code;
     * always trust the value stored in the database.
     *
     * @var array<string, string>
     */
    private const DEFAULTS = [
        'storage.user_files_home' => '/home',
        'storage.app_folders_home' => '/srv',
        'users.invitation_lifetime_hours' => '48',
        'logs.auto_delete_days' => '30',
        'filemanager.trash_retention_days' => '30',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (self::DEFAULTS as $key => $value) {
            $exists = DB::table('settings')->where('key', $key)->exists();

            if (! $exists) {
                DB::table('settings')->insert([
                    'key' => $key,
                    'value' => $value,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('settings')->whereIn('key', array_keys(self::DEFAULTS))->delete();
    }
};
