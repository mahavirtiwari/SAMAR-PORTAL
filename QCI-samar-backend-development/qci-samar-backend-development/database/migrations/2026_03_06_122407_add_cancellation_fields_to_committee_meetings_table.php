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
        Schema::table('committee_meetings', function (Blueprint $table) {
            if (! Schema::hasColumn('committee_meetings', 'cancellation_reason')) {
                $table->text('cancellation_reason')->nullable()->after('minutes');
            }
            if (! Schema::hasColumn('committee_meetings', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('cancellation_reason');
            }
            if (! Schema::hasColumn('committee_meetings', 'cancelled_by')) {
                $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancelled_at');
                $table->foreign('cancelled_by')->references('id')->on('users')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('committee_meetings', function (Blueprint $table) {
            if (Schema::hasColumn('committee_meetings', 'cancelled_by')) {
                $table->dropForeign(['cancelled_by']);
                $table->dropColumn('cancelled_by');
            }
            if (Schema::hasColumn('committee_meetings', 'cancelled_at')) {
                $table->dropColumn('cancelled_at');
            }
            if (Schema::hasColumn('committee_meetings', 'cancellation_reason')) {
                $table->dropColumn('cancellation_reason');
            }
        });
    }
};
