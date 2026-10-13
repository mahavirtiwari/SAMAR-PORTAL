<?php

use App\Models\PendingLoginSession;
use App\Models\Role;
use App\Models\Session;
use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

/*
|--------------------------------------------------------------------------
| Console Routes
|--------------------------------------------------------------------------
|
| This file is where you may define all of your console commands and
| scheduled tasks. These commands can be executed using the Artisan CLI.
|
*/

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

/*
|--------------------------------------------------------------------------
| Scheduled Tasks
|--------------------------------------------------------------------------
|
| Here you can define scheduled tasks for the application. These will run
| automatically based on the defined schedule.
|
*/

// Clean up expired pending login sessions every 15 minutes
Schedule::call(function () {
    PendingLoginSession::where('expires_at', '<', now())->delete();
})->everyFifteenMinutes();

// Reap idle access sessions every 15 minutes. A client that silently disappears
// (closed tab / killed app) never terminates its session, so the row would stay
// is_active for the full JWT TTL and get mistaken for a live session on another
// device. Rows untouched (last_activity_at, falling back to started_at) longer
// than the idle threshold are marked timed-out. Scoped to access rows only —
// refresh rows never get their last_activity_at bumped and are rotated/expired
// on their own lifecycle.
Schedule::call(function () {
    $cutoff = now()->subMinutes((int) config('auth.session.idle_timeout_minutes'));

    // Machine accounts are exempt. The ERP document sync is unattended and may
    // sit idle between batches for far longer than the human idle threshold;
    // reaping its session would expire a token that is still within its own
    // (deliberately longer) lifetime.
    $machineUserIds = User::whereHas('activeRoles', fn ($q) => $q->where('slug', Role::ERP_INTEGRATION))->pluck('id');

    Session::where('token_type', 'access')
        ->where('is_active', true)
        ->whereNotIn('user_id', $machineUserIds)
        ->whereRaw('COALESCE(last_activity_at, started_at) < ?', [$cutoff])
        ->update([
            'is_active' => false,
            'ended_at' => now(),
            'termination_reason' => Session::TERMINATION_TIMEOUT,
        ]);
})->everyFifteenMinutes();

// Archive resolved error logs daily at 2 AM
Schedule::command('error-logs:cleanup --archive')->dailyAt('02:00');

// Delete archived error logs weekly on Monday at 3 AM
Schedule::command('error-logs:cleanup --delete')->weeklyOn(1, '03:00');

// Prune audit logs past the retention window weekly on Monday at 3:30 AM
Schedule::command('audit-logs:cleanup --force')->weeklyOn(1, '03:30');

// Staged certificate renewal reminders, daily at 7 AM
Schedule::command('certificates:notify-expiring')->dailyAt('07:00');

// Monthly recertification reminder. Runs daily but the command stamps a
// per-calendar-month idempotency key, so each open window gets exactly one email
// per month — and a window that opens mid-month is reminded on the next run
// rather than waiting for the 1st.
Schedule::command('certificates:notify-recert-monthly')->dailyAt('08:00');

// Business Central sync: read back processing results hourly (QCI processes
// staged records manually for now, so results can lag by hours or days), and
// re-dispatch failed pushes every 30 minutes (jobs adopt/patch existing
// staging rows, so retries can never duplicate ledger entries).
Schedule::command('bc:sync-results')->hourly();
Schedule::command('bc:retry-failed')->everyThirtyMinutes();

// Re-check payments the bank never gave us a verdict on. A missed return
// callback and a missed push notification together leave a deducted payment
// sitting unsettled forever, so the sweep asks the gateway directly and settles
// the row through the same path the callback uses. Rows are only swept once
// they are older than the configured threshold, and are handed to manual
// reconciliation rather than force-failed once the attempt ceiling is reached.
Schedule::command('payments:verify-pending')->everyThirtyMinutes()->withoutOverlapping();

// Example: Clean up expired tokens daily at 2 AM
// Schedule::command('jwt:clean-expired')->dailyAt('02:00');

// Example: Generate daily reports
// Schedule::command('reports:generate')->dailyAt('03:00');

// Example: Send notification reminders
// Schedule::command('notifications:send-reminders')->hourly();
