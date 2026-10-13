<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_vendor_labs', function (Blueprint $table) {
            $table->id();
            $table->string('lab_name');
            $table->enum('service_provider_type', ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor']);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->index('is_active');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_vendor_labs');
    }
};
