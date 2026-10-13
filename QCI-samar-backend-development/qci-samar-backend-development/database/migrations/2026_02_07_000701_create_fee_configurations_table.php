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
        Schema::create('fee_configurations', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->enum('sector', ['manufacturing', 'service']);
            $table->enum('enterprise_size', ['startup', 'micro', 'small', 'medium', 'large']);
            $table->decimal('base_certification_fee', 12, 2)->default(0);
            $table->decimal('food_and_accommodation_fee', 12, 2)->default(0);
            $table->decimal('gst_percentage', 5, 2)->default(18.00);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            // Unique constraint
            $table->unique(['sector', 'enterprise_size'], 'fee_config_sector_size_unique');

            // Indexes
            $table->index('sector');
            $table->index('enterprise_size');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('fee_configurations');
    }
};
