<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('desktop_apps')
            ->where('identifier', 'support')
            ->update(['enabled' => false]);
    }

    public function down(): void
    {
        DB::table('desktop_apps')
            ->where('identifier', 'support')
            ->update(['enabled' => true]);
    }
};
