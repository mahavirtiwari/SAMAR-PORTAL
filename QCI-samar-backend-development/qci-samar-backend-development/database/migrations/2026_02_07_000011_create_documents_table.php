<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('title', 150);
            $table->string('name');
            $table->string('original_filename');
            $table->string('file_path');
            $table->string('disk')->default('private');
            $table->boolean('is_active')->default(true);
            $table->string('mime_type');
            $table->unsignedBigInteger('size');
            $table->string('extension', 10);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('uploaded_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
