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
            'identifier' => 'logs',
            'name' => 'Logs',
            'description' => 'View and search system and queue logs',
            'type' => 'component',
            'icon_type' => 'tabler',
            'icon_name' => 'IconFileText',
            'color' => '#0ea5e9',
            'component_path' => 'LogsApp',
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
        DesktopApp::where('identifier', 'logs')->delete();
    }
};
