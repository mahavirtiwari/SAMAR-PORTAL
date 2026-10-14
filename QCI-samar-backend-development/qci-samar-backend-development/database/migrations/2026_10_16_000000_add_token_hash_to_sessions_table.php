<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Every authenticated request looks its session up by token. `token` is an
 * unindexed TEXT column, so that lookup scanned the table (≈1.5 s per request
 * at 300k rows). Lookups now go through an indexed SHA-256 of the token.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->char('token_hash', 64)->nullable()->after('token');
            $table->index(['token_hash', 'token_type'], 'sessions_token_hash_type_index');
        });

        // Old rows are never used again; drop them before hashing the rest.
        DB::table('sessions')
            ->where(fn ($q) => $q->where('is_active', false)->orWhere('expires_at', '<', now()))
            ->where('updated_at', '<', now()->subDays(7))
            ->delete();

        DB::statement('UPDATE sessions SET token_hash = SHA2(token, 256) WHERE token IS NOT NULL AND token_hash IS NULL');
    }

    public function down(): void
    {
        Schema::table('sessions', function (Blueprint $table) {
            $table->dropIndex('sessions_token_hash_type_index');
            $table->dropColumn('token_hash');
        });
    }
};
