<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class ProvisionStoreReviewAccount extends Command
{
    /**
     * @var string
     */
    protected $signature = 'store:provision-review-account
        {app : Which app the reviewer is testing — assessor|applicant}
        {--password= : Required on first run. 7-16 chars (the mobile login form rejects anything else).}
        {--email= : Mailbox QCI controls; defaults to store-review-<app>@qci.org.in}
        {--organization= : Applicant only — id or name of the ACTIVE organisation to attach the account to}';

    /**
     * @var string
     */
    protected $description = 'Create or update the Play Store / App Store review account for a mobile app (docs/10-architecture/D-007)';

    /**
     * Two-factor stays OFF: AuthService::login() short-circuits the whole OTP
     * flow for such a user, so a reviewer who cannot read our mailbox can still
     * sign in. Re-run after anyone flips it back on.
     */
    private const APPS = [
        'assessor' => [
            'samar_id' => 'SAMAR-REVIEW-ASR',
            'role' => Role::ASSESSOR,
            'first_name' => 'Store',
            'last_name' => 'Review Assessor',
        ],
        'applicant' => [
            'samar_id' => 'SAMAR-REVIEW-APP',
            'role' => Role::ENTERPRISE_ADMIN,
            'first_name' => 'Store',
            'last_name' => 'Review Applicant',
        ],
    ];

    public function handle(): int
    {
        $app = strtolower((string) $this->argument('app'));

        if (! isset(self::APPS[$app])) {
            $this->error("Unknown app '{$app}'. Expected: ".implode('|', array_keys(self::APPS)));

            return self::FAILURE;
        }

        $spec = self::APPS[$app];
        $samarId = $spec['samar_id'];
        $existing = User::where('samar_id', $samarId)->first();
        $password = $this->option('password');

        if (! $existing && ! $password) {
            $this->error("No account {$samarId} exists yet — pass --password to create it.");

            return self::FAILURE;
        }

        if ($password !== null && (strlen($password) < 7 || strlen($password) > 16)) {
            $this->error('Password must be 7-16 characters — the mobile login form rejects anything else, so a longer one locks the reviewer out.');

            return self::FAILURE;
        }

        $role = Role::where('slug', $spec['role'])->first();

        if (! $role) {
            $this->error("Role '{$spec['role']}' not found. Run the RoleSeeder first.");

            return self::FAILURE;
        }

        $organizationId = null;

        if ($app === 'applicant') {
            $organizationId = $this->resolveOrganizationId($existing);

            if ($organizationId === null) {
                return self::FAILURE;
            }
        }

        $user = $existing ?? new User([
            'samar_id' => $samarId,
            'first_name' => $spec['first_name'],
            'last_name' => $spec['last_name'],
            'mobile_number' => '0000000000',
        ]);

        $user->samar_id = $samarId;
        $user->email = $this->option('email') ?: ($user->email ?: "store-review-{$app}@qci.org.in");
        $user->organization_id = $organizationId;
        $user->status = 'active';
        $user->is_two_factor_enabled = false;
        $user->is_profile_completed = true;
        $user->profile_completed_at = $user->profile_completed_at ?: now();
        $user->email_verified_at = $user->email_verified_at ?: now();

        if ($password) {
            $user->password = Hash::make($password);
        }

        $user->save();

        // The boot hook only auto-generates samar_id when it is empty, but it
        // fires on create with the model's own value — re-assert ours in case a
        // future change to that hook starts overwriting it.
        if ($user->samar_id !== $samarId) {
            $user->samar_id = $samarId;
            $user->saveQuietly();
        }

        if (! $user->hasAnyRole([$spec['role']])) {
            $user->assignRole($role);
        }

        $this->info("Store review account ready: {$user->samar_id} (role: {$spec['role']}, 2FA off)");
        $this->newLine();
        $this->warn('Not done yet — the reviewer needs something to look at:');

        if ($app === 'assessor') {
            $this->line('  * Allocate at least one assessment to this account, in a state the reviewer can open and walk through.');
        } else {
            $this->line('  * Ensure this account has at least one application, far enough along that the site-picture and site-tour screens are reachable.');
            $this->line('  * Confirm the attached organisation is ACTIVE — login refuses an account whose organisation is not.');
        }

        $this->line('  * Sign in from a real device before pasting the credentials into the store consoles.');
        $this->line('  * Review-notes text: <app repo>/docs/40-release/store-release.md');

        return self::SUCCESS;
    }

    /**
     * Applicant roles carry requires_organization, and login refuses an account
     * whose organisation is inactive — so resolve it explicitly rather than
     * letting the account be created into a state that cannot log in.
     */
    private function resolveOrganizationId(?User $existing): ?int
    {
        $option = $this->option('organization');

        if (! $option) {
            if ($existing?->organization_id) {
                return $existing->organization_id;
            }

            $this->error('The applicant account needs --organization (id or name) — its role requires one.');

            return null;
        }

        $organization = is_numeric($option)
            ? Organization::find((int) $option)
            : Organization::where('name', $option)->first();

        if (! $organization) {
            $this->error("Organization '{$option}' not found.");

            return null;
        }

        return $organization->id;
    }
}
