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
        Schema::create('notification_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('email_notification_template_id')->nullable()->constrained('notification_templates')->nullOnDelete();
            $table->string('event', 255);
            $table->string('notifiable_type', 255)->nullable();
            $table->unsignedBigInteger('notifiable_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('recipient_email', 255)->nullable();
            $table->string('recipient_name', 255)->nullable();
            $table->boolean('sent')->default(false);
            $table->enum('status', ['pending', 'queued', 'sent', 'delivered', 'failed', 'bounced'])->default('pending');
            $table->string('subject', 255)->nullable();
            $table->text('body')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->text('error_message')->nullable();
            $table->json('data')->nullable();
            $table->integer('attempts')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('next_retry_at')->nullable();
            $table->integer('priority')->default(5);
            $table->timestamps();

            // Indexes
            $table->index(['notifiable_type', 'notifiable_id']);
            $table->index('event');
            $table->index('status');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_events');
    }
};
