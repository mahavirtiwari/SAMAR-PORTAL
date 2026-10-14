<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SystemSettingsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $now = Carbon::now();

        $settings = [
            // Workflow Settings
            [
                'key' => 'drdo_approval_required',
                'value' => 'true',
                'description' => 'When enabled, ALL applications require DRDO approval before payment',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'certificate_validity_years',
                'value' => '3',
                'description' => 'Number of years a certificate remains valid after issuance',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'recertification_window_days',
                'value' => '90',
                'description' => 'Number of days before certificate expiry when vendors can apply for recertification',
                'created_at' => $now,
                'updated_at' => $now,
            ],

            // General Settings
            [
                'key' => 'application_submission_open',
                'value' => 'true',
                'description' => 'When enabled, new applications can be submitted. Disable to close the portal for new submissions',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'maintenance_mode',
                'value' => 'false',
                'description' => 'When enabled, the system displays a maintenance message and restricts access',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($settings as $setting) {
            DB::table('system_settings')->updateOrInsert(
                ['key' => $setting['key']],
                $setting
            );
            // Bypasses the model, so drop SystemSetting::getValue()'s cached copy.
            Cache::forget('system_setting:'.$setting['key']);
        }

        $this->command->info('System settings seeded successfully! ('.count($settings).' settings)');
    }
}
