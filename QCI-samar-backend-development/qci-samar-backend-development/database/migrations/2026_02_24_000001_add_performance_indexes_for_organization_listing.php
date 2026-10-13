<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds indexes to support OrganizationController@index query performance:
     *
     * 1. organizations.is_profile_completed - used as a filter condition
     * 2. applications(organization_id, created_at) - supports the correlated subquery
     *    that fetches the latest_application_date for sorting
     * 3. certificates(organization_id, status, valid_until) - supports whereHas queries
     *    used for certification_status filtering (certified/expired), extending the
     *    existing idx_certificates_org_status index to cover valid_until
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->index('is_profile_completed', 'idx_organizations_profile_completed');
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->index(
                ['organization_id', 'created_at'],
                'idx_applications_org_created'
            );
        });

        Schema::table('certificates', function (Blueprint $table) {
            $table->index(
                ['organization_id', 'status', 'valid_until'],
                'idx_certificates_org_status_valid'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropIndex('idx_organizations_profile_completed');
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex('idx_applications_org_created');
        });

        Schema::table('certificates', function (Blueprint $table) {
            $table->dropIndex('idx_certificates_org_status_valid');
        });
    }
};
