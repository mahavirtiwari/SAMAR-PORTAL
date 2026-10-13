<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SystemAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $role = Role::where('slug', 'system_admin')->first();

        if (! $role) {
            $this->command->warn("Role 'system_admin' not found. Skipping...");

            return;
        }

        $user = User::firstOrCreate(
            ['email' => 'kanchan@webority.com'],
            [
                'samar_id' => 'SAMAR-010126-001',
                'organization_id' => null,
                'first_name' => 'System',
                'last_name' => 'Admin',
                'mobile_number' => '9999999999',
                'password' => Hash::make('Admin@123456'),
                'status' => 'active',
                'is_profile_completed' => true,
                'profile_completed_at' => now(),
                'email_verified_at' => now(),
            ]
        );

        $user->assignRole($role);
        $this->command->info('System Admin created: kanchan@webority.com');
        $this->command->info('Default password: Admin@123456 (Please change on first login)');
    }
}
