<?php

use App\Models\DesktopApp;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DesktopApp::create([
            'identifier' => 'backup',
            'name' => 'Backup',
            'description' => 'Manage incremental backups with restic',
            'type' => 'component',
            'icon_type' => 'tabler',
            'icon_name' => 'IconCloudUpload',
            'color' => '#22c55e',
            'component_path' => 'BackupApp',
            'is_system' => true,
            'is_global' => true,
            'is_admin_only' => true,
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DesktopApp::where('identifier', 'backup')->delete();
    }
};
