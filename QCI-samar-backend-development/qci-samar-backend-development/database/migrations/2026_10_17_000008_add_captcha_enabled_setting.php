<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * System Settings switch for the security code (CAPTCHA) on the login,
 * sign-up and password-reset forms. Starts on, as today.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::table('system_settings')->where('key', 'captcha_enabled')->exists()) {
            return;
        }

        DB::table('system_settings')->insert([
            'key' => 'captcha_enabled',
            'value' => '1',
            'description' => 'Show the security code (CAPTCHA) on login, sign-up and password reset',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('system_settings')->where('key', 'captcha_enabled')->delete();
    }
};
