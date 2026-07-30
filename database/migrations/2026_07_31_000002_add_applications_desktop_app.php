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
            'identifier' => 'applications',
            'name' => 'Applications',
            'description' => 'Browse and manage applications from app stores',
            'type' => 'component',
            'icon_type' => 'tabler',
            'icon_name' => 'IconLayoutGrid',
            'color' => '#7c3aed',
            'component_path' => 'ApplicationsApp',
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
        DesktopApp::where('identifier', 'applications')->delete();
    }
};
