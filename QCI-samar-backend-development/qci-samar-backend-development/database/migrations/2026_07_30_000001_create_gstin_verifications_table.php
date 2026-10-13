<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Durable record of a live GSTIN verification against the government registry
     * (via the Protean GVS API). Keyed by the GSTIN itself, not by application:
     * a GSTIN's registry data is identical no matter which application references
     * it, so one row serves application submission, payment, and the Business
     * Central pre-push gate. It doubles as the cache — a row whose status is
     * 'verified' and whose verified_at is within the configured TTL is served
     * without re-calling Protean.
     */
    public function up(): void
    {
        Schema::create('gstin_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('gstin', 15)->unique();
            $table->string('provider', 30)->default('protean');

            // Outcome of the last check: verified (Status=S) | rejected (the GSTIN
            // is genuinely invalid/absent) | error (auth/IP/session/technical).
            $table->string('status', 20);

            // Registry snapshot from the last successful verification.
            $table->string('legal_name')->nullable();
            $table->string('trade_name')->nullable();
            $table->string('constitution')->nullable();
            $table->string('taxpayer_type')->nullable();
            $table->string('gstin_status')->nullable();
            $table->string('registration_date')->nullable();
            $table->string('state_jurisdiction')->nullable();
            $table->string('centre_jurisdiction')->nullable();
            $table->text('nature_of_business')->nullable();
            $table->json('principal_address')->nullable();

            // Diagnostics from the last check.
            $table->string('error_code', 30)->nullable();
            $table->string('reason')->nullable();
            $table->json('raw_response')->nullable();

            // verified_at = timestamp of the last SUCCESSFUL verification (null if
            // never verified); the TTL/freshness check reads it. last_checked_at =
            // when Protean was last called, regardless of outcome.
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('last_checked_at')->nullable();

            $table->timestamps();

            $table->index('status', 'idx_gstin_verifications_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gstin_verifications');
    }
};
