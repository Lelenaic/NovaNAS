<?php

use App\Models\DesktopApp;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        DesktopApp::create([
            'identifier' => 'support',
            'name' => 'Support',
            'description' => 'Get help and submit support tickets',
            'type' => 'component',
            'icon_type' => 'tabler',
            'icon_name' => 'IconLifebuoy',
            'color' => '#0ea5e9',
            'component_path' => 'SupportApp',
            'is_system' => true,
            'is_global' => true,
            'is_admin_only' => true,
        ]);
    }

    public function down(): void
    {
        DesktopApp::where('identifier', 'support')->delete();
    }
};
