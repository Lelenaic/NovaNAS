<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trashed_files', function (Blueprint $table) {
            $table->id();
            $table->string('original_path');
            $table->string('trash_path');
            $table->string('filename');
            $table->foreignId('trashed_by')->constrained('users');
            $table->timestamp('trashed_at');
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('trashed_files');
    }
};
