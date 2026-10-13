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
        Schema::create('application_assessment_basic_information', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('assessment_id')->unique()->constrained('application_assessments')->cascadeOnDelete();
            $table->string('category', 255)->nullable();
            $table->json('mfg_drdo_vendor_stores')->nullable();
            $table->json('mfg_products')->nullable();
            $table->json('mfg_raw_materials')->nullable();
            $table->json('mfg_bought_out_parts')->nullable();
            $table->json('mfg_key_processes')->nullable();
            $table->json('mfg_outsourced_processes')->nullable();
            $table->decimal('mfg_production_capacity', 15, 2)->nullable();
            $table->string('mfg_capacity_unit', 50)->nullable();
            $table->string('svc_provider_type', 255)->nullable();
            $table->json('svc_drdo_vendor_labs')->nullable();
            $table->json('svc_services')->nullable();
            $table->json('svc_key_resources')->nullable();
            $table->json('svc_outsourced_components')->nullable();
            $table->json('svc_key_processes')->nullable();
            $table->json('svc_outsourced_processes')->nullable();
            $table->json('customers')->nullable();
            $table->json('third_party_certifications')->nullable();
            $table->foreignId('filled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_assessment_basic_information');
    }
};
