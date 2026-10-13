<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assessment_parameters', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->foreignId('discipline_id')
                ->nullable()
                ->constrained('disciplines')
                ->onDelete('set null');
            $table->unsignedBigInteger('vendor_category_id')->nullable();
            $table->enum('sector', ['manufacturing', 'service']);
            $table->enum('enterprise_size', ['startup', 'micro', 'small', 'medium', 'large']);
            $table->enum('service_provider_type', ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor'])->nullable();
            $table->boolean('is_mandatory')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->index('is_active');
            $table->index('sector', 'idx_parameters_sector');
            $table->index('enterprise_size', 'idx_parameters_enterprise_size');
            $table->index('service_provider_type', 'idx_parameters_service_provider_type');
            $table->index('vendor_category_id', 'idx_parameters_drdo_vendor_category');
            $table->index(
                ['sector', 'enterprise_size', 'service_provider_type', 'discipline_id'],
                'idx_parameters_filter'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assessment_parameters');
    }
};
