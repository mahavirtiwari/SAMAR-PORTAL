<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessor_domains', function (Blueprint $table) {
            $table->id();
            $table->string('domain_name', 255);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index('is_active');
            $table->index('domain_name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessor_domains');
    }
};
