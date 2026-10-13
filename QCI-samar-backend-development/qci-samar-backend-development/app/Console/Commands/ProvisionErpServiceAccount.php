<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ProvisionErpServiceAccount extends Command
{
    /**
     * @var string
     */
    protected $signature = 'erp:provision-service-account';

    /**
     * @var string
     */
    protected $description = 'Create or update the erp_integration role and the Business Central service account from config';

    public function handle(): int
    {
        $config = config('services.business_central.inbound', []);

        if (empty($config['password'])) {
            $this->error('BC_INBOUND_PASSWORD is not set. Aborting — the service account needs an explicit password.');

            return self::FAILURE;
        }

        $role = Role::firstOrCreate(
            ['slug' => Role::ERP_INTEGRATION],
            [
                'name' => 'ERP Integration',
                'description' => 'Machine account for the Business Central ERP to push invoice/receipt PDFs',
                'is_system_role' => true,
                'requires_organization' => false,
                'requires_unit' => false,
                // M2M: concurrent batch calls from BC must not displace each other's sessions.
                'enforce_single_session' => false,
                'level' => 10,
            ]
        );

        $user = User::firstOrCreate(
            ['samar_id' => $config['samar_id']],
            [
                'first_name' => 'Business Central',
                'last_name' => 'ERP',
                'email' => $config['email'],
                'mobile_number' => '0000000000',
                'password' => Hash::make($config['password']),
                'status' => 'active',
                'organization_id' => null,
                'is_profile_completed' => true,
                'profile_completed_at' => now(),
                'email_verified_at' => now(),
            ]
        );

        // Keep the password in sync with config on every run so rotation is a
        // config change + re-run, not a manual reset.
        $user->password = Hash::make($config['password']);
        $user->save();

        if (! $user->hasAnyRole([Role::ERP_INTEGRATION])) {
            $user->assignRole($role);
        }

        $this->info("ERP service account ready: {$user->samar_id} (role: {$role->slug})");

        return self::SUCCESS;
    }
}
