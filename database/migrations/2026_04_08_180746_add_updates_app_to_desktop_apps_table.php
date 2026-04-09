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
            'identifier' => 'updates',
            'name' => 'Updates',
            'description' => 'Manage system updates and upgrades',
            'type' => 'component',
            'icon_type' => 'tabler',
            'icon_name' => 'IconRefresh',
            'color' => '#059669',
            'component_path' => 'UpdatesApp',
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
        DesktopApp::where('identifier', 'updates')->delete();
    }
};
