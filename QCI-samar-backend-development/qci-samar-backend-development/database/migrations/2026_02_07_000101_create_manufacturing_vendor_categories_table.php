<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('manufacturing_vendor_categories', function (Blueprint $table) {
            $table->id();
            $table->string('category_name', 255);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->index('is_active');
            $table->index('category_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('manufacturing_vendor_categories');
    }
};
