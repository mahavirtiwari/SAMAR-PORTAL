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
        Schema::table('meeting_members', function (Blueprint $table) {
            $table->unsignedBigInteger('added_by')->nullable()->after('role');
            $table->boolean('attended')->default(false)->after('added_by');
            $table->text('attendance_notes')->nullable()->after('attended');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('meeting_members', function (Blueprint $table) {
            $table->dropColumn(['added_by', 'attended', 'attendance_notes']);
        });
    }
};
