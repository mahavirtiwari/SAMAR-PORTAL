<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained()->onDelete('cascade');
            $table->string('organization_name', 255)->nullable();
            $table->foreignId('unit_id')->constrained()->onDelete('cascade');
            $table->string('unit_name')->nullable()
                ->comment('Denormalized unit name for historical tracking');
            $table->string('application_number')->unique();
            $table->enum('application_type', ['new', 'renewal'])->default('new');
            $table->enum('sector', ['manufacturing', 'service'])->nullable();
            $table->string('vendor_category')->nullable();
            $table->boolean('is_existing_drdo_vendor')->default(false);
            $table->enum('enterprise_classification', ['startup', 'micro', 'small', 'medium', 'large'])->nullable();
            $table->string('enterprise_name')->nullable();
            $table->text('registered_office_address')->nullable();
            $table->string('registered_office_state')->nullable();
            $table->string('registered_office_district')->nullable();
            $table->string('registered_office_pincode', 10)->nullable();
            $table->string('registered_office_mobile', 20)->nullable();
            $table->string('registered_office_landline', 20)->nullable();
            $table->string('registered_office_email')->nullable();
            $table->string('registered_office_alternate_email')->nullable();
            $table->text('unit_address')->nullable();
            $table->string('unit_state')->nullable();
            $table->string('unit_district')->nullable();
            $table->string('unit_pincode', 10)->nullable();
            $table->string('unit_mobile', 20)->nullable();
            $table->string('unit_landline', 20)->nullable();
            $table->string('unit_email')->nullable();
            $table->string('unit_alternate_email')->nullable();
            $table->date('unit_commencement_date')->nullable();
            $table->string('site_exterior_photo')->nullable();
            $table->string('contact_person_name')->nullable();
            $table->string('contact_person_designation')->nullable();
            $table->string('contact_person_mobile', 20)->nullable();
            $table->string('contact_person_email')->nullable();
            $table->enum('ownership_type', ['proprietorship', 'partnership', 'private_limited', 'public_limited', 'joint_venture', 'limited_liability_partnership', 'other'])->nullable();
            $table->integer('male_employees_count')->default(0);
            $table->integer('female_employees_count')->default(0);
            $table->integer('other_employees_count')->nullable();
            $table->boolean('is_exporting')->default(false);
            $table->json('export_countries')->nullable();
            $table->decimal('export_percentage', 5, 2)->nullable();
            $table->string('gst_number', 15)->nullable();
            $table->string('gst_certificate_file')->nullable();
            $table->string('govt_organisation_name')->nullable();
            $table->string('govt_registration_certificate')->nullable();
            $table->boolean('is_blacklisted')->nullable()->default(null);
            $table->text('blacklisted_organizations')->nullable();
            $table->boolean('has_ongoing_enquiry')->nullable()->default(null);
            $table->string('drdo_registration_number')->nullable();
            $table->string('drdo_certificate_file')->nullable();
            $table->string('dpiit_registration_number', 20)->nullable();
            $table->string('dpiit_certificate_file')->nullable();
            $table->string('udyam_registration_number')->nullable();
            $table->string('udyam_certificate_file')->nullable();
            $table->string('cin', 21)->nullable()
                ->comment('Corporate Identification Number (21-character alphanumeric code from ROC)');
            $table->string('incorporation_certificate_file')->nullable();
            $table->decimal('mfg_production_capacity', 15, 2)->nullable();
            $table->string('mfg_capacity_unit')->nullable();
            $table->json('mfg_drdo_vendor_stores')->nullable()
                ->comment('DRDO Vendor Stores: [{store_name}]');
            $table->json('mfg_products')->nullable()
                ->comment('Products: [{product_name, total_production_capacity, capacity_unit, current_utilized_capacity, commencement_date, is_exported, export_countries, export_percentage}]');
            $table->json('mfg_raw_materials')->nullable()
                ->comment('Raw Materials: [{material_name, is_imported, import_country, import_percentage}]');
            $table->json('mfg_bought_out_parts')->nullable()
                ->comment('Bought Out Parts: [{part_name, is_imported, import_country, import_percentage}]');
            $table->json('mfg_key_processes')->nullable()
                ->comment('Key Processes: [{process_name}]');
            $table->json('mfg_outsourced_processes')->nullable()
                ->comment('Outsourced Processes: [{process_name}]');
            $table->enum('svc_provider_type', ['annual_maintenance_contract', 'critical_service_provider', 'civil_works_contractor'])
                ->nullable()
                ->comment('Type of service provider');
            $table->json('svc_drdo_vendor_labs')->nullable()
                ->comment('DRDO Vendor Labs: [{lab_name}]');
            $table->json('svc_services')->nullable()
                ->comment('Services: [{service_name, total_services_capacity, capacity_unit, current_utilized_capacity, commencement_date, is_exported, export_countries, export_percentage}]');
            $table->json('svc_key_resources')->nullable()
                ->comment('Key Service Resources: [{resource_name, is_imported, import_country, import_percentage}]');
            $table->json('svc_outsourced_components')->nullable()
                ->comment('Outsourced Service Components: [{component_name, is_imported, import_country, import_percentage}]');
            $table->json('svc_key_processes')->nullable()
                ->comment('Key Processes: [{process_name}]');
            $table->json('svc_outsourced_processes')->nullable()
                ->comment('Outsourced Processes: [{process_name}]');
            $table->json('customers')->nullable()
                ->comment('Customers: [{customer_name, customer_type, country}]');
            $table->json('third_party_certifications')->nullable();
            $table->enum('status', [
                'draft',
                'drdo_approval_pending',
                'payment_pending',
                'payment_completed',
                'in_progress',
                'certified',
                'rejected',
            ])->default('draft');
            $table->date('preferred_assessment_date')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->boolean('is_drdo_approval_required')->nullable()
                ->comment('Captures whether DRDO approval was required when application was submitted');
            $table->timestamp('drdo_approved_at')->nullable();
            $table->text('drdo_approval_remarks')->nullable();
            $table->timestamp('payment_completed_at')->nullable();
            $table->timestamp('allocated_at')->nullable();
            $table->timestamp('assessment_started_at')->nullable();
            $table->timestamp('assessment_completed_at')->nullable();
            $table->timestamp('qc_completed_at')->nullable();
            $table->timestamp('committee_review_at')->nullable();
            $table->timestamp('certified_at')->nullable();
            $table->timestamp('certificate_expiry_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->enum('payment_status', ['pending', 'success', 'failed'])->default('pending');
            $table->decimal('payment_amount', 10, 2)->default(0);
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->index('application_number', 'idx_applications_number');
            $table->index('status', 'idx_applications_status');
            $table->index('gst_number', 'idx_applications_gst');
            $table->index('payment_status');
            $table->index('submitted_at', 'idx_applications_submitted');
            $table->index('certified_at', 'idx_applications_certified');
            $table->index('certificate_expiry_at', 'idx_applications_cert_expiry');
            $table->index('created_at', 'idx_applications_created');
            $table->index(['status', 'created_at'], 'idx_applications_status_created');
            $table->index(['organization_id', 'status'], 'idx_applications_org_status');
            $table->index(['unit_id', 'status'], 'idx_applications_unit_status');
            $table->index(['status', 'submitted_at'], 'idx_applications_status_submitted');
            $table->index(['payment_status', 'organization_id'], 'idx_applications_payment_org');
            $table->index('sector', 'idx_applications_sector');
            $table->index('svc_provider_type', 'idx_applications_service_provider_type');
            $table->index('enterprise_classification', 'idx_applications_enterprise_class');
            $table->index('is_existing_drdo_vendor', 'idx_applications_drdo_vendor');
            $table->index('drdo_registration_number', 'idx_applications_drdo_reg');
            $table->index('udyam_registration_number', 'idx_applications_udyam_reg');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};
