<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Adds a composite index on sessions table for efficient session validation
     * queries used by the ValidateActiveSession middleware.
     */
    public function up(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->index(
                ['token_type', 'user_id', 'is_active'],
                'sessions_token_type_user_active_index'
            );
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropIndex('sessions_token_type_user_active_index');
        });
    }
};
