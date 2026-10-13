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
        Schema::create('notification_templates', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('slug', 255)->unique();
            $table->string('name', 255);
            $table->text('description')->nullable();
            $table->string('event', 255);
            $table->string('category', 255)->nullable();
            $table->string('subject', 255)->nullable();
            $table->json('cc')->nullable();
            $table->json('bcc')->nullable();
            $table->json('variables')->nullable();
            $table->text('variables_description')->nullable();
            $table->json('recipient_roles')->nullable();
            $table->boolean('send_to_creator')->default(false);
            $table->boolean('has_attachment')->default(false);
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(5);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            // Indexes
            $table->index('slug');
            $table->index('event');
            $table->index('category');
            $table->index('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notification_templates');
    }
};
