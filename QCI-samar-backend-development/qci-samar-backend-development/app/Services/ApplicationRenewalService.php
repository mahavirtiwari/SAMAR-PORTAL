<?php

namespace App\Services;

use App\Models\Application;
use Illuminate\Support\Facades\DB;

class ApplicationRenewalService
{
    /**
     * Attributes that must never carry over from the source application onto a
     * renewal draft. Everything else (enterprise/unit details, products,
     * customers, document file paths) is copied so the form prefills and the
     * applicant edits only what changed.
     *
     * Eloquent's replicate() already drops the primary key, timestamps and the
     * soft-delete column; these are the domain attributes we additionally reset.
     */
    private const NON_CLONED_ATTRIBUTES = [
        'application_number',
        'client_uuid',
        'status',
        'submitted_at',
        'is_drdo_approval_required',
        'drdo_approved_at',
        'drdo_approval_remarks',
        'payment_completed_at',
        'allocated_at',
        'assessment_started_at',
        'assessment_completed_at',
        'qc_completed_at',
        'committee_review_at',
        'certified_at',
        'certificate_expiry_at',
        'rejected_at',
        'rejection_reason',
        'payment_status',
        'payment_amount',
        'preferred_assessment_date',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    /**
     * Clone a certified application into a fresh renewal draft.
     *
     * The draft keeps the same unit (so the existing Unit Admin / contact
     * person is reused automatically — no new account) and is linked back to
     * its source via previous_application_id. Idempotent: if a live renewal
     * draft already exists for this source it is returned instead of creating a
     * second one.
     */
    public function createRenewalDraft(Application $source, int $userId): Application
    {
        return DB::transaction(function () use ($source, $userId) {
            $existing = Application::where('previous_application_id', $source->id)
                ->where('status', '!=', 'rejected')
                ->orderByDesc('id')
                ->first();

            if ($existing) {
                return $existing;
            }

            $draft = $source->replicate(self::NON_CLONED_ATTRIBUTES);

            $draft->application_number = Application::generateApplicationNumber();
            $draft->application_type = 'renewal';
            $draft->previous_application_id = $source->id;
            $draft->status = 'draft';
            $draft->payment_status = 'pending';
            $draft->payment_amount = 0;
            $draft->created_by = $userId;
            $draft->updated_by = $userId;
            $draft->save();

            return $draft;
        });
    }
}
