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
        Schema::create('backup_executions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('backup_job_id')->constrained()->cascadeOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->string('status')->default('running'); // running, success, failed
            $table->text('error_message')->nullable();
            $table->integer('snapshots_created')->default(0);
            $table->bigInteger('bytes_processed')->nullable();
            $table->integer('files_processed')->nullable();
            $table->float('duration_seconds')->nullable();
            $table->text('logs')->nullable();
            $table->timestamps();

            $table->index(['backup_job_id', 'started_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('backup_executions');
    }
};
