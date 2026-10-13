<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Track the scheduled re-verification sweep against the gateway.
     *
     * The sweep filters on these columns directly, so they are real columns
     * rather than keys inside the metadata JSON.
     */
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->unsignedSmallInteger('verification_attempts')->default(0)->after('is_verified');
            $table->timestamp('last_verified_at')->nullable()->after('verification_attempts');

            // The sweep reads unsettled rows for one gateway, oldest first.
            $table->index(['gateway', 'status', 'verification_attempts'], 'payments_verification_sweep_index');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_verification_sweep_index');
            $table->dropColumn(['verification_attempts', 'last_verified_at']);
        });
    }
};
