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
        Schema::table('applications', function (Blueprint $table) {
            // Per-file upload metadata keyed by file field name:
            // { site_exterior_photo: { latitude, longitude, captured_at, uploaded_at }, ... }
            $table->json('file_upload_metadata')->nullable()->after('site_exterior_photo');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('file_upload_metadata');
        });
    }
};
