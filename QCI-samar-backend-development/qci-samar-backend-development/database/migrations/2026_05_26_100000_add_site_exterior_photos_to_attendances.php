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
        Schema::table('application_assessment_attendances', function (Blueprint $table) {
            $table->string('site_exterior_photo_1_path', 255)->nullable()->after('selfie_path');
            $table->string('site_exterior_photo_2_path', 255)->nullable()->after('site_exterior_photo_1_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_assessment_attendances', function (Blueprint $table) {
            $table->dropColumn(['site_exterior_photo_1_path', 'site_exterior_photo_2_path']);
        });
    }
};
