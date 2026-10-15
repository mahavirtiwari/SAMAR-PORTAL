<?php

namespace App\Services;

use App\Models\Application;
use App\Models\Assessment;
use App\Models\Organization;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * The full history of an enterprise, oldest first: registration, user accounts,
 * account activation/deactivation (with reasons), every application status change,
 * assessment status changes, payments and certificates.
 *
 * Built from the permanent tables (status histories, payments, certificates), not
 * from audit_logs, which the retention job prunes.
 */
class EnterpriseJourneyService
{
    private const PAYMENT_TYPES = [
        'application_fee' => 'Application fee',
        'assessment_fee' => 'Assessment fee',
        'certification_fee' => 'Certification fee',
        'surveillance_fee' => 'Surveillance fee',
        'other' => 'Fee',
    ];

    /** @var array<string, string> role slug => role name */
    private array $roleNames = [];

    /** @var array<int, string> user id => full name */
    private array $userNames = [];

    /**
     * @return array{events: array<int, array<string, mixed>>, applications: array<int, array<string, mixed>>}
     */
    public function build(Organization $organization, ?int $applicationId = null): array
    {
        $this->roleNames = Role::query()->pluck('name', 'slug')->all();

        $applications = Application::query()
            ->where('organization_id', $organization->id)
            ->orderBy('created_at')
            ->get(['id', 'application_number', 'application_type', 'sector', 'status', 'created_at']);
        $scoped = $applicationId ? $applications->where('id', $applicationId)->values() : $applications;
        $appIds = $scoped->pluck('id')->all();
        $appById = $applications->keyBy('id');

        $events = collect();

        // Enterprise-level events (registration, accounts) belong to the unfiltered
        // journey; filtering by an application shows only that application's story.
        if ($applicationId === null) {
            $events = $events
                ->merge($this->registrationEvents($organization))
                ->merge($this->accountEvents($organization));
        }

        $events = $events
            ->merge($this->applicationEvents($scoped))
            ->merge($this->applicationStatusEvents($appIds, $appById))
            ->merge($this->assessmentStatusEvents($appIds, $appById))
            ->merge($this->paymentEvents($appIds, $appById))
            ->merge($this->certificateEvents($appIds, $appById));

        $this->resolveActorNames($events);

        $sorted = $events
            ->sortBy(fn (array $e) => [$e['at']->getTimestamp(), $e['order']])
            ->values()
            ->map(function (array $e) {
                $actorId = $e['actor_id'] ?? null;
                unset($e['order'], $e['actor_id']);
                $e['at'] = $e['at']->toIso8601String();
                $e['actor'] = $e['actor'] ?? ($actorId ? ['name' => $this->userNames[$actorId] ?? null, 'role' => $e['actor_role'] ?? null] : null);
                unset($e['actor_role']);

                return $e;
            })
            ->all();

        $machine = (new Application)->stateMachine();

        return [
            'events' => $sorted,
            'applications' => $applications->map(fn (Application $a) => [
                'id' => $a->id,
                'application_number' => $a->application_number,
                'sector' => $a->sector,
                'status' => $a->status,
                'status_label' => $machine->getStateLabel($a->status),
            ])->values()->all(),
        ];
    }

    private function registrationEvents(Organization $organization): Collection
    {
        $events = collect([[
            'at' => Carbon::parse($organization->created_at),
            'order' => 0,
            'type' => 'enterprise_registered',
            'category' => 'enterprise',
            'title' => 'Enterprise registered',
            'description' => $organization->name,
        ]]);

        $users = User::query()
            ->where('organization_id', $organization->id)
            ->with(['roles' => fn ($q) => $q->select('roles.id', 'roles.slug', 'roles.name')])
            ->get(['id', 'first_name', 'last_name', 'created_at']);

        foreach ($users as $user) {
            $roles = $user->roles->pluck('name')->implode(', ');
            $events->push([
                'at' => Carbon::parse($user->created_at),
                'order' => 1,
                'type' => 'user_created',
                'category' => 'account',
                'title' => 'User account created',
                'description' => trim($user->full_name.($roles !== '' ? " ({$roles})" : '')),
            ]);
        }

        return $events;
    }

    /** Activation / deactivation of the enterprise and of its users, with the reason given. */
    private function accountEvents(Organization $organization): Collection
    {
        $userIds = User::query()->where('organization_id', $organization->id)->pluck('id');
        $userNames = User::query()->whereIn('id', $userIds)->get(['id', 'first_name', 'last_name'])
            ->mapWithKeys(fn (User $u) => [$u->id => $u->full_name]);
        $userMachine = (new User)->stateMachine();

        return DB::table('account_status_histories')
            ->where(function ($q) use ($organization, $userIds) {
                $q->where(fn ($q) => $q->where('subject_type', Organization::class)->where('subject_id', $organization->id))
                    ->orWhere(fn ($q) => $q->where('subject_type', User::class)->whereIn('subject_id', $userIds));
            })
            ->get()
            ->map(function ($row) use ($userNames, $userMachine) {
                $isEnterprise = $row->subject_type === Organization::class;
                $verb = match ($row->to_status) {
                    'active' => $row->from_status === null ? 'activated' : 'reactivated',
                    'inactive' => 'deactivated',
                    default => strtolower($userMachine->getStateLabel($row->to_status)),
                };

                return [
                    'at' => Carbon::parse($row->changed_at),
                    'order' => 2,
                    'type' => $isEnterprise ? 'enterprise_status' : 'user_status',
                    'category' => 'account',
                    'title' => $isEnterprise ? 'Enterprise '.$verb : 'User '.$verb,
                    'description' => $isEnterprise ? null : ($userNames[$row->subject_id] ?? null),
                    'reason' => $row->remarks,
                    'status' => $row->to_status,
                    'actor_id' => $row->changed_by,
                    'actor_role' => $this->roleNames[$row->changed_by_role] ?? null,
                ];
            });
    }

    private function applicationEvents(Collection $applications): Collection
    {
        return $applications->map(fn (Application $a) => [
            'at' => Carbon::parse($a->created_at),
            'order' => 3,
            'type' => 'application_started',
            'category' => 'application',
            'title' => ($a->application_type === 'renewal' ? 'Renewal application' : 'Application').' started',
            'description' => $a->sector ? ucfirst($a->sector).' sector' : null,
            'application' => $this->appRef($a),
        ]);
    }

    private function applicationStatusEvents(array $appIds, Collection $appById): Collection
    {
        if ($appIds === []) {
            return collect();
        }
        $machine = (new Application)->stateMachine();

        return DB::table('application_status_histories')
            ->whereIn('application_id', $appIds)
            ->get()
            ->map(fn ($row) => [
                'at' => Carbon::parse($row->changed_at),
                'order' => 4,
                'type' => 'application_status',
                'category' => 'application',
                'title' => $machine->getStateLabel($row->to_status),
                'description' => $row->from_status ? 'From '.$machine->getStateLabel($row->from_status) : null,
                'reason' => $row->remarks,
                'status' => $row->to_status,
                'application' => $this->appRef($appById->get($row->application_id)),
                'actor_id' => $row->changed_by,
                'actor_role' => $this->roleNames[$row->changed_by_role] ?? null,
            ]);
    }

    private function assessmentStatusEvents(array $appIds, Collection $appById): Collection
    {
        if ($appIds === []) {
            return collect();
        }
        $machine = (new Assessment)->stateMachine();

        return DB::table('application_assessment_status_histories as h')
            ->join('application_assessments as a', 'a.id', '=', 'h.assessment_id')
            ->whereIn('a.application_id', $appIds)
            ->get(['h.*', 'a.application_id'])
            ->map(fn ($row) => [
                'at' => Carbon::parse($row->changed_at),
                'order' => 5,
                'type' => 'assessment_status',
                'category' => 'assessment',
                'title' => 'Assessment: '.$machine->getStateLabel($row->to_status),
                'description' => $row->from_status ? 'From '.$machine->getStateLabel($row->from_status) : null,
                'reason' => $row->remarks,
                'status' => $row->to_status,
                'application' => $this->appRef($appById->get($row->application_id)),
                'actor_id' => $row->changed_by,
                'actor_role' => $this->roleNames[$row->changed_by_role] ?? null,
            ]);
    }

    private function paymentEvents(array $appIds, Collection $appById): Collection
    {
        if ($appIds === []) {
            return collect();
        }

        return DB::table('payments')
            ->whereIn('application_id', $appIds)
            ->whereIn('status', ['success', 'failed'])
            ->get(['application_id', 'payment_type', 'amount', 'status', 'completed_at', 'failed_at', 'initiated_at', 'user_id'])
            ->map(function ($row) use ($appById) {
                $paid = $row->status === 'success';
                $fee = self::PAYMENT_TYPES[$row->payment_type] ?? 'Payment';

                return [
                    'at' => Carbon::parse(($paid ? $row->completed_at : $row->failed_at) ?? $row->initiated_at),
                    'order' => 6,
                    'type' => $paid ? 'payment_received' : 'payment_failed',
                    'category' => 'payment',
                    'title' => $paid ? "{$fee} paid" : "{$fee} payment failed",
                    'description' => '₹'.number_format((float) $row->amount, 2),
                    'status' => $row->status,
                    'application' => $this->appRef($appById->get($row->application_id)),
                    'actor_id' => $row->user_id,
                ];
            });
    }

    private function certificateEvents(array $appIds, Collection $appById): Collection
    {
        if ($appIds === []) {
            return collect();
        }

        return DB::table('certificates')
            ->whereIn('application_id', $appIds)
            ->get(['application_id', 'certificate_number', 'issue_date', 'valid_until', 'status'])
            ->map(fn ($row) => [
                'at' => Carbon::parse($row->issue_date)->endOfDay(),
                'order' => 7,
                'type' => 'certificate_issued',
                'category' => 'certificate',
                'title' => 'Certificate issued',
                'description' => $row->certificate_number.' · valid until '.Carbon::parse($row->valid_until)->format('d M Y')
                    .($row->status !== 'active' ? ' · now '.$row->status : ''),
                'status' => $row->status,
                'application' => $this->appRef($appById->get($row->application_id)),
            ]);
    }

    private function resolveActorNames(Collection $events): void
    {
        $ids = $events->pluck('actor_id')->filter()->unique()->values();
        $this->userNames = $ids->isEmpty() ? [] : User::query()->whereIn('id', $ids)->get(['id', 'first_name', 'last_name'])
            ->mapWithKeys(fn (User $u) => [$u->id => $u->full_name])->all();
    }

    /** @return array{id: int, application_number: string}|null */
    private function appRef(?Application $application): ?array
    {
        return $application ? ['id' => $application->id, 'application_number' => $application->application_number] : null;
    }
}
