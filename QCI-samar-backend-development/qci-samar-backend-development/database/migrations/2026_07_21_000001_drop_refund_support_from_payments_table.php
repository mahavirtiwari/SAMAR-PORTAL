<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * QCI does not refund. The applicant's payment declaration states the amount is
 * "non-refundable, non-adjustable & non-transferable irrespective of the outcome
 * of the Certification process", so the refund columns and the refund statuses
 * were never reachable — no row has ever carried either.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn([
                'refund_amount',
                'refund_id',
                'refund_initiated_at',
                'refunded_at',
                'refund_reason',
            ]);
        });

        DB::statement(
            "ALTER TABLE payments MODIFY COLUMN status
             ENUM('initiated','pending','processing','success','failed','cancelled')
             NOT NULL DEFAULT 'initiated'"
        );
    }

    public function down(): void
    {
        DB::statement(
            "ALTER TABLE payments MODIFY COLUMN status
             ENUM('initiated','pending','processing','success','failed','cancelled','refund_initiated','refunded','partially_refunded')
             NOT NULL DEFAULT 'initiated'"
        );

        Schema::table('payments', function (Blueprint $table) {
            $table->decimal('refund_amount', 10, 2)->nullable();
            $table->string('refund_id', 255)->nullable();
            $table->timestamp('refund_initiated_at')->nullable();
            $table->timestamp('refunded_at')->nullable();
            $table->text('refund_reason')->nullable();
        });
    }
};
