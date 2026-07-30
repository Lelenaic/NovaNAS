<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('installed_applications', function (Blueprint $table) {
            $table->string('port_map')->nullable()->after('icon');
            $table->string('app_index')->nullable()->after('port_map');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('installed_applications', function (Blueprint $table) {
            $table->dropColumn(['port_map', 'app_index']);
        });
    }
};
