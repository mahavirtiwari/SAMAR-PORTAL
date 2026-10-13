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
        Schema::create('certificates', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('application_id')->constrained('applications')->cascadeOnDelete();
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained('units')->cascadeOnDelete();
            $table->foreignId('committee_decision_id')->nullable()->constrained('committee_decisions')->nullOnDelete();
            $table->string('certificate_number', 255)->unique();
            $table->string('qr_code', 255)->nullable();
            $table->string('verification_url', 255)->nullable();
            $table->string('certificate_type', 255)->default('certification');
            $table->string('scheme', 255)->nullable();
            $table->string('scope', 255)->nullable();
            $table->date('issue_date');
            $table->date('valid_from');
            $table->date('valid_until');
            $table->integer('validity_months')->default(12);
            $table->enum('status', ['active', 'expired', 'suspended', 'revoked', 'renewed'])->default('active');
            $table->date('suspended_from')->nullable();
            $table->date('suspended_until')->nullable();
            $table->text('suspension_reason')->nullable();
            $table->unsignedBigInteger('suspended_by')->nullable();
            $table->date('revoked_at')->nullable();
            $table->text('revocation_reason')->nullable();
            $table->unsignedBigInteger('revoked_by')->nullable();
            $table->foreignId('renewed_by_certificate_id')->nullable()->constrained('certificates')->nullOnDelete();
            $table->foreignId('renews_certificate_id')->nullable()->constrained('certificates')->nullOnDelete();
            $table->decimal('final_score', 10, 2)->nullable();
            $table->string('grade', 255)->nullable();
            $table->foreignId('certificate_document_id')->nullable()->constrained('documents')->nullOnDelete();
            $table->string('certificate_pdf_path', 255)->nullable();
            $table->text('digital_signature')->nullable();
            $table->string('signature_algorithm', 255)->nullable();
            $table->string('signatory_name', 255)->nullable();
            $table->string('signatory_designation', 255)->nullable();
            $table->date('signed_date')->nullable();
            $table->unsignedBigInteger('issued_by')->nullable();
            $table->timestamp('issued_at')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->text('remarks')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_public')->default(false);
            $table->boolean('allow_verification')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unsignedBigInteger('deleted_by')->nullable();

            // Indexes
            $table->index('certificate_number', 'idx_certificates_number');
            $table->index('qr_code');
            $table->index('status', 'idx_certificates_status');
            $table->index('issue_date', 'idx_certificates_issue_date');
            $table->index('valid_until', 'idx_certificates_valid_until');
            $table->index(['status', 'valid_until'], 'idx_certificates_status_expiry');
            $table->index(['organization_id', 'status'], 'idx_certificates_org_status');
            $table->index(['issued_at', 'status'], 'idx_certificates_issued_status');
            $table->index('certificate_type', 'idx_certificates_type');
            $table->index('created_at', 'idx_certificates_created');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificates');
    }
};
