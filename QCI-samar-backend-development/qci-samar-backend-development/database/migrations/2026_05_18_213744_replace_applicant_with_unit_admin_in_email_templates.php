<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private array $slugs = [
        'payment-received',
        'assessment-scheduled',
        'certificate-issued',
        'application-approved',
        'assessment-completed',
        'application-rejected',
        'drdo-approved',
        'application-received',
        'assessment-feedback-request',
    ];

    public function up(): void
    {
        $this->mutateRoles($this->slugs, function (array $roles) {
            $roles = array_values(array_filter($roles, fn ($r) => $r !== 'applicant'));
            if (! in_array('unit_admin', $roles, true)) {
                $roles[] = 'unit_admin';
            }

            return $roles;
        });

        // assessment-completed is customer-facing copy; ops_manager is misrouted here.
        $this->mutateRoles(['assessment-completed'], function (array $roles) {
            return array_values(array_filter($roles, fn ($r) => $r !== 'operations_manager'));
        });
    }

    public function down(): void
    {
        $this->mutateRoles(['assessment-completed'], function (array $roles) {
            if (! in_array('operations_manager', $roles, true)) {
                $roles[] = 'operations_manager';
            }

            return $roles;
        });

        $this->mutateRoles($this->slugs, function (array $roles) {
            $roles = array_values(array_filter($roles, fn ($r) => $r !== 'unit_admin'));
            if (! in_array('applicant', $roles, true)) {
                array_unshift($roles, 'applicant');
            }

            return $roles;
        });
    }

    private function mutateRoles(array $slugs, callable $mutator): void
    {
        DB::table('notification_templates')
            ->whereIn('slug', $slugs)
            ->get(['id', 'recipient_roles'])
            ->each(function ($row) use ($mutator) {
                $roles = json_decode($row->recipient_roles ?? '[]', true) ?: [];
                $next = $mutator($roles);
                DB::table('notification_templates')
                    ->where('id', $row->id)
                    ->update(['recipient_roles' => json_encode($next)]);
            });
    }
};
