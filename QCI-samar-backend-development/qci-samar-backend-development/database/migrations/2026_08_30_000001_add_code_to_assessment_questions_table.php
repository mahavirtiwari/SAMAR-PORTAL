<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assessment_questions', function (Blueprint $table) {
            $table->string('code', 30)->nullable()->after('id');
        });

        $this->backfillCodes();

        Schema::table('assessment_questions', function (Blueprint $table) {
            $table->unique('code', 'uniq_assessment_questions_code');
        });
    }

    public function down(): void
    {
        Schema::table('assessment_questions', function (Blueprint $table) {
            $table->dropUnique('uniq_assessment_questions_code');
            $table->dropColumn('code');
        });
    }

    /**
     * Give every existing question a code of the form <parameter code>-Q01, numbered by id
     * within its parameter. Soft-deleted rows are included so a sequence number is never
     * reused by a later question.
     */
    private function backfillCodes(): void
    {
        $rows = DB::table('assessment_questions')
            ->join('assessment_parameters', 'assessment_parameters.id', '=', 'assessment_questions.parameter_id')
            ->orderBy('assessment_questions.parameter_id')
            ->orderBy('assessment_questions.id')
            ->select('assessment_questions.id', 'assessment_parameters.code as parameter_code')
            ->get();

        $sequences = [];

        foreach ($rows as $row) {
            $parameterCode = $row->parameter_code ?: 'ORPHAN';
            $sequences[$parameterCode] = ($sequences[$parameterCode] ?? 0) + 1;

            DB::table('assessment_questions')
                ->where('id', $row->id)
                ->update(['code' => $parameterCode.'-Q'.str_pad((string) $sequences[$parameterCode], 2, '0', STR_PAD_LEFT)]);
        }
    }
};
