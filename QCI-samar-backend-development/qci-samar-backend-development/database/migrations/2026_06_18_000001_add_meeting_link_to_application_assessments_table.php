<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->string('meeting_link', 2048)->nullable()->after('scheduled_end_date');
        });
    }

    public function down(): void
    {
        Schema::table('application_assessments', function (Blueprint $table) {
            $table->dropColumn('meeting_link');
        });
    }
};
