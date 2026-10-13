<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The mobile cutover feature transitions an assessment to mobile_complete
     * when the last team member (the lead) completes on mobile, but the status
     * ENUM was never extended for it — MySQL truncates the write and the
     * lead's completion fails with SQLSTATE 01000. Laravel can't alter ENUMs
     * through the schema builder, hence raw statements.
     */
    public function up(): void
    {
        // ENUM redefinition is MySQL-only; on other drivers (e.g. SQLite in tests)
        // the column is plain text and needs no change.
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        DB::statement("
            ALTER TABLE application_assessments
            MODIFY COLUMN status ENUM(
                'allocation_pending',
                'scheduled',
                'in_progress',
                'mobile_complete',
                'submitted_for_qc',
                'qc_feedback',
                'ready_for_committee',
                'committee_review',
                'committee_feedback',
                'certified'
            ) NOT NULL DEFAULT 'allocation_pending'
        ");
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        // Park any cutover rows back on in_progress so the narrowed ENUM
        // doesn't truncate them.
        DB::statement("
            UPDATE application_assessments SET status = 'in_progress'
            WHERE status = 'mobile_complete'
        ");
        DB::statement("
            ALTER TABLE application_assessments
            MODIFY COLUMN status ENUM(
                'allocation_pending',
                'scheduled',
                'in_progress',
                'submitted_for_qc',
                'qc_feedback',
                'ready_for_committee',
                'committee_review',
                'committee_feedback',
                'certified'
            ) NOT NULL DEFAULT 'allocation_pending'
        ");
    }
};
