<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_assessment_attendances', function (Blueprint $table) {
            $columns = array_values(array_filter(
                ['site_exterior_photo_1_path', 'site_exterior_photo_2_path'],
                fn ($col) => Schema::hasColumn('application_assessment_attendances', $col)
            ));

            if (! empty($columns)) {
                $table->dropColumn($columns);
            }
        });
    }

    public function down(): void
    {
        Schema::table('application_assessment_attendances', function (Blueprint $table) {
            if (! Schema::hasColumn('application_assessment_attendances', 'site_exterior_photo_1_path')) {
                $table->string('site_exterior_photo_1_path', 255)->nullable()->after('selfie_path');
            }
            if (! Schema::hasColumn('application_assessment_attendances', 'site_exterior_photo_2_path')) {
                $table->string('site_exterior_photo_2_path', 255)->nullable()->after('site_exterior_photo_1_path');
            }
        });
    }
};
