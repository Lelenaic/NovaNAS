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
        Schema::create('installed_applications', function (Blueprint $table) {
            $table->id();
            $table->string('app_id');
            $table->string('store_provider');
            $table->string('title');
            $table->string('tagline')->nullable();
            $table->text('description')->nullable();
            $table->string('category');
            $table->string('installed_version');
            $table->string('available_version')->nullable();
            $table->string('author')->nullable();
            $table->string('developer')->nullable();
            $table->string('icon')->nullable();
            $table->string('compose_path');
            $table->enum('status', ['running', 'stopped', 'error'])->default('running');
            $table->foreignId('installed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('installed_at');
            $table->timestamps();

            $table->unique(['app_id', 'store_provider']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('installed_applications');
    }
};
