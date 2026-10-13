<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The GST and government-registration answers were never stored — the portal inferred them
     * from whether gst_number / govt_organisation_name held a value. That makes a genuine "No"
     * indistinguishable from "not answered yet", so reopening a draft showed both questions
     * pre-answered as No (BUG-05727).
     *
     * Column names match the hasGst / hasGovtRegistration properties the draft endpoints have
     * always advertised in their OpenAPI request bodies but never actually accepted.
     *
     * Nullable with no default, matching is_blacklisted / has_ongoing_enquiry:
     * null = not answered, false = answered No, true = answered Yes.
     */
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->boolean('has_gst')->nullable()->default(null)->after('gst_certificate_file');
            $table->boolean('has_govt_registration')->nullable()->default(null)->after('govt_registration_certificate');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['has_gst', 'has_govt_registration']);
        });
    }
};
