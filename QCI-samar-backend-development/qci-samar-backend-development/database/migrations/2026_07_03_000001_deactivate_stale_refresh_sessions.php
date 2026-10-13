<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy refresh rows that were never terminated: class-scoped displacement
        // (device_type IN [...]) can't reach a NULL device_type, and rows already
        // past their own expiry were simply never rotated/cleaned up.
        DB::table('sessions')
            ->where('token_type', 'refresh')
            ->where('is_active', true)
            ->where('expires_at', '<', now())
            ->update([
                'is_active' => false,
                'ended_at' => now(),
                'termination_reason' => 'expired',
            ]);

        DB::table('sessions')
            ->where('token_type', 'refresh')
            ->where('is_active', true)
            ->whereNull('device_type')
            ->where('started_at', '<', '2026-06-23 00:00:00')
            ->update([
                'is_active' => false,
                'ended_at' => now(),
                'termination_reason' => 'forced',
            ]);
    }

    public function down(): void
    {
        // No-op. This was a one-time cleanup of stale/legacy rows; there is no
        // record of which rows were touched to reverse it safely.
    }
};
