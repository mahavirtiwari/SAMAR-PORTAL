<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('alternate_email')->nullable();
            $table->string('mobile_number', 15)->nullable();
            $table->string('landline_number', 15)->nullable();
            $table->string('contact_person_name')->nullable();
            $table->string('contact_person_designation')->nullable();
            $table->string('contact_person_email')->nullable();
            $table->string('contact_person_mobile_number', 15)->nullable();
            $table->text('address')->nullable();
            $table->string('state')->nullable();
            $table->string('district')->nullable();
            $table->string('pincode', 6)->nullable();
            $table->enum('unit_type', ['service', 'manufacturing'])->nullable();
            $table->date('commencement_date')->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};
