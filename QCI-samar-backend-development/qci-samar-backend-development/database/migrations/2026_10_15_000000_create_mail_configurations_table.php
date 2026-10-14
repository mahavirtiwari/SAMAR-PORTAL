<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Outgoing mail server settings managed by the System Admin
 * (Settings → Email Server). A single row; while `enabled` is false the
 * MAIL_* values from the environment are used unchanged.
 *
 * Kept out of system_settings on purpose: that table is readable by every
 * signed-in user, and this one holds the SMTP password (encrypted).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mail_configurations', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->string('host')->nullable();
            $table->unsignedInteger('port')->nullable();
            $table->enum('encryption', ['tls', 'ssl', 'none'])->default('tls');
            $table->string('username')->nullable();
            $table->text('password')->nullable();
            $table->string('from_address')->nullable();
            $table->string('from_name')->nullable();
            $table->unsignedInteger('timeout')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mail_configurations');
    }
};
