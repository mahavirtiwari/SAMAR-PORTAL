<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records which site tour picture an evidence was created from. Without it the client can only
     * guess the link by comparing file names and captions, so two pictures sharing a caption match
     * each other and the picker can attach or delete the wrong one. [BUG-08779]
     */
    public function up(): void
    {
        Schema::table('application_assessment_response_evidences', function (Blueprint $table) {
            // Nullable: evidence can also be uploaded directly, with no site tour origin. Kept on
            // delete rather than cascading, because removing a site tour picture must not remove
            // the evidence an assessor already attached to an answered question.
            $table->foreignId('source_site_tour_picture_id')
                ->nullable()
                ->after('response_id');

            // Named explicitly: the derived name would be 77 characters, over MySQL's 64 limit,
            // and the migration fails outright. Long-named siblings in this schema do the same.
            $table->foreign('source_site_tour_picture_id', 'fk_evidence_source_stp')
                ->references('id')
                ->on('application_assessment_site_tour_pictures')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('application_assessment_response_evidences', function (Blueprint $table) {
            $table->dropForeign('fk_evidence_source_stp');
            $table->dropColumn('source_site_tour_picture_id');
        });
    }
};
