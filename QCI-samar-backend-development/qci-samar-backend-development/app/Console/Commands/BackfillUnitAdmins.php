<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Models\Role;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillUnitAdmins extends Command
{
    protected $signature = 'applications:backfill-unit-admins
                            {--app-id= : Backfill for a specific application ID}
                            {--dry-run : Show what would be created without making changes}';

    protected $description = 'Create Unit Admin users for applications where the unit has none yet but the application carries a contact_person_email.';

    public function handle(UserService $userService): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $specificAppId = $this->option('app-id');

        $unitAdminRoleId = Role::where('slug', Role::UNIT_ADMIN)->value('id');
        if (! $unitAdminRoleId) {
            $this->error("Role '".Role::UNIT_ADMIN."' not found.");

            return self::FAILURE;
        }

        $query = Application::query()
            ->whereNotNull('contact_person_email')
            ->where('contact_person_email', '!=', '')
            ->whereNotNull('unit_id')
            ->whereNotExists(function ($q) use ($unitAdminRoleId) {
                $q->select(DB::raw(1))
                    ->from('user_role')
                    ->whereColumn('user_role.unit_id', 'applications.unit_id')
                    ->where('user_role.role_id', $unitAdminRoleId)
                    ->where('user_role.is_active', true);
            });

        if ($specificAppId) {
            $query->where('id', $specificAppId);
        }

        $apps = $query->orderBy('id')->get();

        if ($apps->isEmpty()) {
            $this->info('No applications need backfill.');

            return self::SUCCESS;
        }

        $this->info(sprintf('Found %d application(s) needing a Unit Admin.', $apps->count()));
        if ($dryRun) {
            $this->warn('Dry run — no users will be created.');
        }

        // Group by unit so two apps for the same unit don't try to create two admins.
        $processedUnits = [];
        $created = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($apps as $app) {
            if (isset($processedUnits[$app->unit_id])) {
                $this->line(sprintf('  app#%d unit#%d — already handled in this run, skipping', $app->id, $app->unit_id));
                $skipped++;

                continue;
            }
            $processedUnits[$app->unit_id] = true;

            $contactData = [
                'email' => $app->contact_person_email,
                'name' => $app->contact_person_name ?? '',
                'designation' => $app->contact_person_designation ?? null,
                'mobile' => $app->contact_person_mobile ?? null,
            ];

            $this->line(sprintf(
                '  app#%d unit#%d org#%d email=%s name=%s',
                $app->id,
                $app->unit_id,
                $app->organization_id,
                $contactData['email'],
                $contactData['name']
            ));

            // Use the application's creator (the Enterprise Admin who filed it) as the
            // actor — same path the production flow would have taken. Falls back to any
            // enterprise_admin of the same org if the original creator is gone.
            $actor = $app->created_by
                ? User::find($app->created_by)
                : null;

            if (! $actor || ! $actor->hasRole(Role::ENTERPRISE_ADMIN)) {
                $actor = User::whereHas('roles', function ($q) use ($app) {
                    $q->where('slug', Role::ENTERPRISE_ADMIN)
                        ->where('user_role.organization_id', $app->organization_id)
                        ->where('user_role.is_active', true);
                })->first();
            }

            if (! $actor) {
                $this->error(sprintf('    → FAILED: no enterprise_admin found for org#%d', $app->organization_id));
                $failed++;

                continue;
            }

            if ($dryRun) {
                $this->line(sprintf('    actor: user#%d (%s)', $actor->id, $actor->email));

                continue;
            }

            try {
                $user = $userService->createUnitAdminFromContactPerson(
                    $contactData,
                    $app->organization_id,
                    $app->unit_id,
                    $actor,
                    $app->application_number
                );
                $this->info(sprintf('    → created user #%d (%s)', $user->id, $user->samar_id));
                $created++;
            } catch (\Throwable $e) {
                $this->error(sprintf('    → FAILED: %s', $e->getMessage()));
                $failed++;
            }
        }

        $this->newLine();
        $this->info(sprintf('Done. created=%d skipped=%d failed=%d', $created, $skipped, $failed));

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
