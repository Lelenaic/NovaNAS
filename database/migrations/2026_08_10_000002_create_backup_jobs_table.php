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
        Schema::create('backup_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('backup_repository_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->boolean('is_enabled')->default(true);
            $table->json('source_paths');
            $table->json('exclude_patterns')->nullable();
            $table->string('cron_expression')->default('0 2 * * *');
            $table->timestamp('next_run_at')->nullable();
            $table->json('retention_policy')->default('{}');
            $table->json('tags')->nullable();
            $table->boolean('one_file_system')->default(false);
            $table->string('compression')->default('auto');
            $table->string('status')->default('idle'); // idle, running, failed, success
            $table->timestamp('last_backup_at')->nullable();
            $table->bigInteger('last_backup_size')->nullable();
            $table->text('last_error')->nullable();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->index('next_run_at');
            $table->index(['is_enabled', 'next_run_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_jobs');
    }
};
