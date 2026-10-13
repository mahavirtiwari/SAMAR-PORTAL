<?php

namespace App\Models;

use App\Exceptions\BusinessException;
use App\Services\StateMachine\AssessmentStateMachine;
use App\Traits\HasAuditLog;
use App\Traits\HasOrganizationScope;
use App\Traits\HasStateMachine;
use App\Traits\HasUnitScope;
use App\Traits\TracksUserActions;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class Assessment extends Model
{
    use HasAuditLog, HasFactory, HasOrganizationScope, HasStateMachine, HasUnitScope, SoftDeletes, TracksUserActions;

    /**
     * Assessments are high-churn: every field edit would otherwise generate a
     * generic audit row. Only the semantic workflow-transition entries logged
     * by the state machine are kept (TASK-05816).
     */
    protected static function auditsGenericChanges(): bool
    {
        return false;
    }

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'application_assessments';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'application_id',
        'organization_id',
        'unit_id',
        'status',
        'scheduled_start_date',
        'scheduled_end_date',
        'meeting_link',
        'reschedule_version',
        'rescheduled_at',
        'actual_start_date',
        'actual_end_date',
        'total_score',
        'qc_feedback',
        'qc_reviewed_by',
        'qc_reviewed_at',
        'committee_remarks',
        'committee_feedback',
        'committee_reviewed_by',
        'committee_reviewed_at',
        'cancellation_reason',
        'cancelled_by',
        'allocated_at',
        'started_at',
        'submitted_at',
        'completed_at',
        'step_progress',
        'allocation_locked_at',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'total_score' => 'decimal:2',
        'scheduled_start_date' => 'date',
        'scheduled_end_date' => 'date',
        'actual_start_date' => 'date',
        'actual_end_date' => 'date',
        'allocated_at' => 'datetime',
        'rescheduled_at' => 'datetime',
        'started_at' => 'datetime',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
        'allocation_locked_at' => 'datetime',
        'qc_reviewed_at' => 'datetime',
        'committee_reviewed_at' => 'datetime',
        'step_progress' => 'array',
        'qc_feedback' => 'array',
        'committee_feedback' => 'array',
    ];

    /**
     * Step progress constants
     */
    public const STEP_PARAMETER_ALLOCATION = 'parameter_allocation';

    public const STEP_SITE_PICTURES = 'site_pictures';

    public const STEP_OPENING_MEETING = 'opening_meeting';

    public const STEP_SITE_TOUR = 'site_tour';

    public const STEP_BASIC_INFORMATION = 'basic_information';

    public const STEP_ASSESSMENT_PARAMETERS = 'assessment_parameters';

    public const STEP_CLOSING_MEETING = 'closing_meeting';

    public const STEP_STATUS_PENDING = 'pending';

    public const STEP_STATUS_IN_PROGRESS = 'in_progress';

    public const STEP_STATUS_COMPLETED = 'completed';

    public const STATUS_ALLOCATION_PENDING = 'allocation_pending';

    public const STATUS_SCHEDULED = 'scheduled';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_MOBILE_COMPLETE = 'mobile_complete';

    public const STATUS_SUBMITTED_FOR_QC = 'submitted_for_qc';

    public const STATUS_QC_FEEDBACK = 'qc_feedback';

    public const STATUS_READY_FOR_COMMITTEE = 'ready_for_committee';

    public const STATUS_COMMITTEE_REVIEW = 'committee_review';

    public const STATUS_COMMITTEE_FEEDBACK = 'committee_feedback';

    public const STATUS_CERTIFIED = 'certified';

    /**
     * Maximum number of times the Rating Committee may send an assessment back
     * to the assessor. Once this many committee send-backs exist, the only
     * remaining committee action is to certify. Mirrored on the web UI.
     */
    public const MAX_COMMITTEE_SEND_BACKS = 2;

    /**
     * Assessment states eligible for feedback submission.
     * Feedback can be submitted once assessment reaches submitted_for_qc or later.
     */
    public const FEEDBACK_ELIGIBLE_STATES = [
        self::STATUS_SUBMITTED_FOR_QC,
        self::STATUS_QC_FEEDBACK,
        self::STATUS_READY_FOR_COMMITTEE,
        self::STATUS_COMMITTEE_REVIEW,
        self::STATUS_COMMITTEE_FEEDBACK,
        self::STATUS_CERTIFIED,
    ];

    /**
     * Statuses from which an assessment may still be reset (restarted from the
     * beginning). Once field work is submitted for QC or later, the captured
     * data is under review and must never be wiped by a device-side reset.
     */
    public const RESETTABLE_STATUSES = [
        self::STATUS_ALLOCATION_PENDING,
        self::STATUS_SCHEDULED,
        self::STATUS_IN_PROGRESS,
    ];

    /**
     * All assessment steps in order.
     */
    public const STEPS = [
        self::STEP_PARAMETER_ALLOCATION,
        self::STEP_SITE_PICTURES,
        self::STEP_OPENING_MEETING,
        self::STEP_SITE_TOUR,
        self::STEP_BASIC_INFORMATION,
        self::STEP_ASSESSMENT_PARAMETERS,
        self::STEP_CLOSING_MEETING,
    ];

    /**
     * Get the application that owns the assessment.
     *
     * @return BelongsTo<Application, $this>
     */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /**
     * Get the organization that owns the assessment.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the unit that owns the assessment.
     */
    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    /**
     * Get the team members relationship.
     */
    public function teamMembers(): HasMany
    {
        return $this->hasMany(AssessmentTeamMember::class);
    }

    /**
     * Pivot rows linking this assessment to committee meetings.
     */
    public function meetingAssessments(): HasMany
    {
        return $this->hasMany(CommitteeMeetingAssessment::class);
    }

    /**
     * The lead assessor team member. A genuine Eloquent relation (unlike
     * getLeadAssessor) so it — and its latestAttendance — can be eager-loaded.
     */
    public function leadTeamMember(): HasOne
    {
        return $this->hasOne(AssessmentTeamMember::class)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR);
    }

    /**
     * Resolve the lead assessor User. Not an Eloquent relation —
     * do not pass to with()/load()/loadMissing(). See AssessmentTeamMember.
     */
    public function getLeadAssessor()
    {
        return $this->teamMembers()
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->with('user')
            ->first()
            ?->user;
    }

    /**
     * Resolve a collection of co-assessor Users. Not an Eloquent relation —
     * do not pass to with()/load()/loadMissing(). See AssessmentTeamMember.
     */
    public function getCoAssessors()
    {
        return $this->teamMembers()
            ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR)
            ->with('user')
            ->get()
            ->pluck('user');
    }

    /**
     * Get all team members with their users.
     */
    public function getTeamWithUsers()
    {
        return $this->teamMembers()
            ->with('user')
            ->get()
            ->map(function ($member) {
                return [
                    'user' => $member->user,
                    'role' => $member->role,
                ];
            });
    }

    /**
     * Add a team member to the assessment.
     *
     * @param  bool  $replaceExisting  If true and adding lead_assessor, removes existing lead_assessor first
     */
    public function addTeamMember(int $userId, string $role = AssessmentTeamMember::ROLE_CO_ASSESSOR, bool $replaceExisting = true): AssessmentTeamMember
    {
        // If adding a lead assessor and replaceExisting is true, remove existing lead assessor first
        if ($role === AssessmentTeamMember::ROLE_LEAD_ASSESSOR && $replaceExisting) {
            $this->teamMembers()
                ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
                ->delete();
        }

        return $this->teamMembers()->create([
            'user_id' => $userId,
            'role' => $role,
        ]);
    }

    /**
     * Remove a team member from the assessment.
     */
    public function removeTeamMember(int $userId): bool
    {
        return $this->teamMembers()->where('user_id', $userId)->delete() > 0;
    }

    /**
     * Get the copied parameters for this assessment.
     */
    public function parameters(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentParameter::class);
    }

    /**
     * Get the copied questions for this assessment.
     */
    public function questions(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentQuestion::class);
    }

    /**
     * Get the responses for this assessment.
     */
    public function responses(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentResponse::class);
    }

    /**
     * Get the status histories for the assessment.
     */
    public function statusHistories(): HasMany
    {
        return $this->hasMany(AssessmentStatusHistory::class)->orderBy('changed_at', 'desc');
    }

    /**
     * Get attendance records for this assessment.
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentAttendance::class);
    }

    /**
     * Get site pictures for this assessment (Step 2).
     */
    public function sitePictures(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentSitePicture::class);
    }

    /**
     * Get site tour pictures for this assessment (Step 4).
     */
    public function siteTourPictures(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentSiteTourPicture::class);
    }

    /**
     * Get meetings for this assessment (Steps 3 & 7).
     */
    public function meetings(): HasMany
    {
        return $this->hasMany(ApplicationAssessmentMeeting::class);
    }

    /**
     * Get the opening meeting for this assessment.
     */
    public function openingMeeting(): HasOne
    {
        return $this->hasOne(ApplicationAssessmentMeeting::class)
            ->where('type', ApplicationAssessmentMeeting::TYPE_OPENING);
    }

    /**
     * Get the closing meeting for this assessment.
     */
    public function closingMeeting(): HasOne
    {
        return $this->hasOne(ApplicationAssessmentMeeting::class)
            ->where('type', ApplicationAssessmentMeeting::TYPE_CLOSING);
    }

    /**
     * Get the basic information for this assessment (Step 5).
     */
    public function basicInformation(): HasOne
    {
        return $this->hasOne(ApplicationAssessmentBasicInformation::class);
    }

    /**
     * Allocate assessor to the assessment via team members.
     */
    public function allocateAssessor(int $leadAssessorId, ?int $coAssessorId = null): bool
    {
        if (! in_array($this->status, [self::STATUS_ALLOCATION_PENDING, self::STATUS_SCHEDULED])) {
            return false;
        }

        // Add lead assessor to team
        $this->addTeamMember($leadAssessorId, AssessmentTeamMember::ROLE_LEAD_ASSESSOR);

        // Add co-assessor if provided
        if ($coAssessorId) {
            $this->addTeamMember($coAssessorId, AssessmentTeamMember::ROLE_CO_ASSESSOR);
        }

        // Use state machine for status transition - afterTransition handles timestamps
        $this->stateMachine()->transition('schedule', [
            'remarks' => 'Assessor allocated',
        ]);

        return true;
    }

    /**
     * Start the assessment and copy parameters/questions from master tables.
     */
    public function startAssessment(): bool
    {
        if (! in_array($this->status, [self::STATUS_SCHEDULED])) {
            return false;
        }

        // Copy parameters and questions from master tables
        $this->copyAssessmentData();

        // Use state machine for status transition - afterTransition handles timestamps
        $this->stateMachine()->transition('start', [
            'remarks' => 'Assessment started',
        ]);

        return true;
    }

    /**
     * Copy parameters and questions from master tables to application assessment tables.
     * This creates an immutable snapshot of the assessment criteria.
     *
     * Called when assessment is created (after payment completion) to copy
     * applicable parameters and questions from master tables.
     */
    public function copyAssessmentData(): void
    {
        $application = $this->application;

        if (! $application) {
            Log::warning('Cannot copy assessment data: no application found', [
                'assessment_id' => $this->id,
            ]);

            return;
        }

        // Check if data already copied (prevent duplicate copies)
        if ($this->parameters()->exists()) {
            Log::info('Assessment data already copied, skipping', [
                'assessment_id' => $this->id,
                'parameters_count' => $this->parameters()->count(),
            ]);

            return;
        }

        // Get applicable parameters from master table
        $masterParameters = AssessmentParameter::active()
            ->forApplication(
                $application->sector,
                $application->enterprise_classification,
                $application->svc_provider_type,
                null, // disciplineId - not used for filtering at this stage
                $application->vendor_category // Pass vendor category name
            )
            ->with(['discipline', 'questions' => fn ($q) => $q->active()->with('options')])
            ->get();

        // Refuse to build an assessment on a questionnaire that does not add up. The
        // parameter score is sum(selected_score x weightage/100), so a parameter whose
        // active weightage is not exactly 100% produces a score outside the 0-5 scale, and
        // that score feeds the overall rating and therefore the certification level.
        //
        // Nothing checked this before. A bulk import left 209 parameters at up to 200%,
        // every assessment created from them inherited the fault in its own snapshot, and
        // it surfaced only when a reviewer noticed a parameter scoring 10.00 out of 5.
        // Failing here names the parameters and keeps the bad questionnaire out of an
        // assessment, which is far cheaper than discovering it after certification.
        $malformed = $masterParameters
            ->filter(fn ($parameter) => (int) $parameter->questions->sum('weightage') !== 100)
            ->map(fn ($parameter) => ($parameter->code ?? $parameter->id).' ('.(int) $parameter->questions->sum('weightage').'%)')
            ->values();

        if ($malformed->isNotEmpty()) {
            Log::error('Refusing to copy assessment data: parameter weightage does not total 100%', [
                'assessment_id' => $this->id,
                'application_id' => $application->id,
                'parameters' => $malformed->all(),
            ]);

            throw new BusinessException(
                'This assessment cannot be created because some assessment parameters do not add up to 100%. '.
                'Please correct the following parameters and try again: '.$malformed->take(10)->implode(', ').
                ($malformed->count() > 10 ? ' and '.($malformed->count() - 10).' more.' : '.')
            );
        }

        Log::info('Copying assessment data from master tables', [
            'assessment_id' => $this->id,
            'application_id' => $application->id,
            'sector' => $application->sector,
            'enterprise_classification' => $application->enterprise_classification,
            'svc_provider_type' => $application->svc_provider_type,
            'master_parameters_count' => $masterParameters->count(),
        ]);

        // Collect all questions data keyed by master parameter ID for bulk insert
        // We insert parameters one at a time to capture their new IDs, then bulk insert all questions
        $allQuestionsData = [];
        $now = now()->toDateTimeString();

        foreach ($masterParameters as $masterParameter) {
            // Generate code from parameter ID if not available (master table may not have code column)
            $parameterCode = $masterParameter->code ?? 'PARAM-'.str_pad($masterParameter->id, 4, '0', STR_PAD_LEFT);

            // Insert parameter and capture its new ID
            $newParameterId = DB::table('application_assessment_parameters')->insertGetId([
                'assessment_id' => $this->id,
                'discipline_name' => $masterParameter->discipline?->name,
                'code' => $parameterCode,
                'name' => $masterParameter->name,
                'is_mandatory' => $masterParameter->is_mandatory,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Collect questions for bulk insert
            foreach ($masterParameter->questions as $masterQuestion) {
                $options = $masterQuestion->options->sortBy('score');
                $optionData = [];

                // Map options to columns (assuming scores 1-5)
                $optionIndex = 1;
                foreach ($options as $option) {
                    if ($optionIndex <= 5) {
                        $optionData["option_{$optionIndex}_text"] = $option->option_text;
                        $optionData["option_{$optionIndex}_score"] = $option->score;
                        $optionIndex++;
                    }
                }

                // Fill remaining options if less than 5
                while ($optionIndex <= 5) {
                    $optionData["option_{$optionIndex}_text"] = '';
                    $optionData["option_{$optionIndex}_score"] = $optionIndex;
                    $optionIndex++;
                }

                // Generate code from question ID if not available (master table may not have code column)
                $questionCode = $masterQuestion->code ?? 'Q-'.str_pad($masterQuestion->id, 5, '0', STR_PAD_LEFT);

                $allQuestionsData[] = array_merge([
                    'assessment_id' => $this->id,
                    'parameter_id' => $newParameterId,
                    'code' => $questionCode,
                    'question_text' => $masterQuestion->question_text,
                    'category' => $masterQuestion->category,
                    'weightage' => $masterQuestion->weightage,
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $optionData);
            }
        }

        // Bulk insert all questions in a single query
        if (! empty($allQuestionsData)) {
            DB::table('application_assessment_questions')->insert($allQuestionsData);
        }

        Log::info('Assessment data copied successfully', [
            'assessment_id' => $this->id,
            'parameters_copied' => $this->parameters()->count(),
            'questions_copied' => $this->questions()->count(),
        ]);
    }

    /**
     * Submit assessment for QC.
     *
     * @throws \InvalidArgumentException if validation fails
     */
    public function submitForQC(): bool
    {
        if ($this->status !== self::STATUS_MOBILE_COMPLETE) {
            return false;
        }

        // Validate responses before submission
        $validation = $this->validateResponsesForSubmission();
        if (! $validation['valid']) {
            throw new BusinessException(
                'Cannot submit assessment: '.implode(', ', $validation['errors'])
            );
        }

        if (! $this->areAllTeamMembersMobileComplete()) {
            throw new BusinessException(
                'Cannot submit assessment: all team members must complete on mobile before submission.'
            );
        }

        if (! $this->areAllCoAssessorsWebSubmitted()) {
            throw new BusinessException(
                'All co-assessors must submit on web before submitting for QC.'
            );
        }

        // Calculate scores before submitting
        $this->calculateScore();

        // Use state machine for status transition - afterTransition handles timestamps
        $this->stateMachine()->transition('submit_for_qc', [
            'remarks' => 'Assessment submitted for QC review',
        ]);

        return true;
    }

    /**
     * Validate responses before submission.
     *
     * Once a parameter is assigned (mandatory or optional), all its questions
     * must be answered before the assessment can be submitted.
     *
     * @return array{valid: bool, errors: array<string>}
     */
    public function validateResponsesForSubmission(): array
    {
        $errors = $this->incompleteParameters()
            ->map(fn (array $parameter) => self::describeIncompleteParameter($parameter))
            ->all();

        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Parameters that must be fully answered before the assessment can move on, but are
     * not: every mandatory parameter, every parameter assigned to a team member, and every
     * optional parameter the assessors have started. An optional parameter nobody touched
     * is legitimately skipped.
     *
     * This is the ONE definition of "incomplete" for submission. The state-machine guard
     * used to check only mandatory parameters and the pre-submit validation only assigned
     * ones, so a started-but-unassigned optional parameter passed both and its partial
     * weighted sum was shown as a finished score (2.50 for Level 5 answers at 50%).
     *
     * @return Collection<int, array{code: string, name: string, answered: int, total: int}>
     */
    public function incompleteParameters(): Collection
    {
        $answeredQuestionIds = $this->responses()
            ->whereNotNull('selected_option')
            ->pluck('question_id')
            ->flip();

        return $this->parameters()
            ->with('questions:id,parameter_id')
            ->get()
            ->map(function (ApplicationAssessmentParameter $parameter) use ($answeredQuestionIds) {
                $total = $parameter->questions->count();
                $answered = $parameter->questions
                    ->filter(fn ($question) => $answeredQuestionIds->has($question->id))
                    ->count();

                $mustBeComplete = $parameter->is_mandatory
                    || $parameter->assigned_to_team_member_id !== null
                    || $answered > 0;

                if (! $mustBeComplete || $answered >= $total) {
                    return null;
                }

                return [
                    'code' => (string) $parameter->code,
                    'name' => (string) $parameter->name,
                    'answered' => $answered,
                    'total' => $total,
                ];
            })
            ->filter()
            ->values();
    }

    /**
     * @param  array{code: string, name: string, answered: int, total: int}  $parameter
     */
    public static function describeIncompleteParameter(array $parameter): string
    {
        return "Parameter {$parameter['code']} {$parameter['name']} has {$parameter['answered']} of {$parameter['total']} questions answered";
    }

    /**
     * Check if assessment can be submitted for QC.
     *
     * @return array{can_submit: bool, errors: array<string>}
     */
    public function canSubmitForQC(): array
    {
        if ($this->status !== self::STATUS_MOBILE_COMPLETE) {
            return [
                'can_submit' => false,
                'errors' => ['All team members must complete on mobile before the assessment can be submitted for QC'],
            ];
        }

        $validation = $this->validateResponsesForSubmission();
        $errors = $validation['errors'];

        if (! $this->areAllTeamMembersMobileComplete()) {
            $errors[] = 'All team members must complete on mobile before submission';
        }

        if (! $this->areAllCoAssessorsWebSubmitted()) {
            $errors[] = 'All co-assessors must submit on web before submitting for QC';
        }

        return [
            'can_submit' => empty($errors),
            'errors' => $errors,
        ];
    }

    /**
     * Calculate total score (rating) from responses.
     *
     * The rating is calculated as:
     * Rating = Sum of Parameter Scores / Number of Parameters
     *
     * Where each Parameter Score = Sum of weighted_scores for questions in that parameter
     * And weighted_score = selected_option × (weightage / 100)
     *
     * The resulting rating is on a 0-5 scale and determines the certification level:
     * - 0.0 to 1.5 → Level 1
     * - >1.5 to 2.5 → Level 2
     * - >2.5 to 3.5 → Level 3
     * - >3.5 to 4.5 → Level 4
     * - >4.5 to 5.0 → Level 5
     */
    public function calculateScore(): void
    {
        $responses = $this->responses()
            ->whereNotNull('selected_option')
            ->with('question')
            ->get();

        if ($responses->isEmpty()) {
            $this->update(['total_score' => null]);

            return;
        }

        // Group responses by parameter_id and calculate score per parameter
        // Weightages per parameter are enforced to sum to exactly 100%, so sum stays on 0-5 scale
        $parameterScores = $responses->groupBy(function ($response) {
            return $response->question->parameter_id ?? 0;
        })->map(function ($parameterResponses) {
            return $parameterResponses->sum('weighted_score');
        });

        // Filter out null/zero parameter_ids and get count
        $validParameterScores = $parameterScores->filter(fn ($score, $key) => $key !== 0);
        $numberOfParameters = $validParameterScores->count();

        if ($numberOfParameters === 0) {
            $this->update(['total_score' => null]);

            return;
        }

        // Calculate rating: Sum of parameter scores / Number of parameters
        $sumOfParameterScores = $validParameterScores->sum();
        $rating = $sumOfParameterScores / $numberOfParameters;

        // Round to 2 decimal places
        $rating = round($rating, 2);

        $this->update([
            'total_score' => $rating,
        ]);
    }

    /**
     * Format a 0–5 maturity score as a "Level N" label, or $nullLabel when score is null.
     * Thin wrapper over ratingLevelFromScore() — single source of truth for both the
     * numeric level and the display string.
     */
    public static function ratingLabelFromScore(?float $score, string $nullLabel = '-'): string
    {
        $level = self::ratingLevelFromScore($score);

        return $level === null ? $nullLabel : "Level {$level}";
    }

    /**
     * Map a 0–5 maturity score to its certification level (1–5).
     *
     * Boundaries (single source of truth — all PDFs/services must call this):
     * - 0.0 to 1.5 → Level 1
     * - >1.5 to 2.5 → Level 2
     * - >2.5 to 3.5 → Level 3
     * - >3.5 to 4.5 → Level 4
     * - >4.5 to 5.0 → Level 5
     *
     * Returns null when score is null (no assessment data yet).
     */
    public static function ratingLevelFromScore(?float $score): ?int
    {
        if ($score === null) {
            return null;
        }

        return match (true) {
            $score > 4.5 => 5,
            $score > 3.5 => 4,
            $score > 2.5 => 3,
            $score > 1.5 => 2,
            default => 1,
        };
    }

    /**
     * Calculate assessor-only score, ignoring any rc_score overrides.
     *
     * Mirrors calculateScore() but uses selected_score directly so MoM can
     * show the assessor's pre-committee total alongside the RC-effective
     * total_score. Returns null when no questions are scored yet.
     */
    public function calculateAssessorOnlyScore(): ?float
    {
        $responses = $this->responses()
            ->whereNotNull('selected_option')
            ->with('question')
            ->get();

        if ($responses->isEmpty()) {
            return null;
        }

        $parameterScores = $responses->groupBy(function ($response) {
            return $response->question->parameter_id ?? 0;
        })->map(function ($parameterResponses) {
            return $parameterResponses->sum(function ($r) {
                $weightage = $r->question->weightage ?? 0;

                return ($r->selected_score ?? 0) * ($weightage / 100);
            });
        });

        $valid = $parameterScores->filter(fn ($score, $key) => $key !== 0);
        if ($valid->isEmpty()) {
            return null;
        }

        return round($valid->sum() / $valid->count(), 2);
    }

    /**
     * Log status change.
     */
    protected function logStatusChange(?string $fromStatus, string $toStatus, ?string $remarks = null): void
    {
        AssessmentStatusHistory::create([
            'assessment_id' => $this->id,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'changed_by' => auth()->id(),
            'changed_by_role' => auth()->user()?->activeRoles->first()?->slug,
            'remarks' => $remarks,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }

    /**
     * Scope: Filter assessments by organization's registered state (via application).
     */
    public function scopeForStates(Builder $query, array $states): Builder
    {
        if (empty($states)) {
            return $query;
        }

        return $query->whereHas('application', function ($q) use ($states) {
            Application::applyStateVisibility($q, $states);
        });
    }

    /**
     * Scope: Filter by status.
     */
    public function scopeByStatus(Builder $query, string|array $status): Builder
    {
        if (is_array($status)) {
            return $query->whereIn('status', $status);
        }

        return $query->where('status', $status);
    }

    /**
     * Scope: Assigned to specific assessor (via team members).
     */
    public function scopeForAssessor(Builder $query, int $assessorId): Builder
    {
        return $query->whereHas('teamMembers', function ($q) use ($assessorId) {
            $q->where('user_id', $assessorId);
        });
    }

    /**
     * Scope: assessments whose LEAD assessor is this user.
     */
    public function scopeForLeadAssessor(Builder $query, int $assessorId): Builder
    {
        return $query->whereHas('teamMembers', function ($q) use ($assessorId) {
            $q->where('user_id', $assessorId)
                ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR);
        });
    }

    /**
     * Scope: assessments carrying this user as a CO-assessor.
     */
    public function scopeForCoAssessor(Builder $query, int $assessorId): Builder
    {
        return $query->whereHas('teamMembers', function ($q) use ($assessorId) {
            $q->where('user_id', $assessorId)
                ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR);
        });
    }

    /**
     * Scope: Exclude assessments this user has already cut over on mobile.
     * Used for the mobile sync-down so a completed assessor stops receiving an
     * assessment, while the lead keeps receiving it until they complete too.
     */
    public function scopeNotMobileCompletedBy(Builder $query, int $userId): Builder
    {
        return $query->whereDoesntHave('teamMembers', function ($q) use ($userId) {
            $q->where('user_id', $userId)->whereNotNull('mobile_completed_at');
        });
    }

    /**
     * Scope: Pending QC review.
     */
    public function scopePendingQC(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SUBMITTED_FOR_QC);
    }

    /**
     * Scope: Active assessments (not in final states).
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNotIn('status', [self::STATUS_CERTIFIED]);
    }

    /**
     * Scope: Search assessments by application number, enterprise name, or unit name.
     * The web listing displays applications.unit_name as "Enterprise/Unit Name", so the
     * search must cover it — users type the name they see on screen.
     */
    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where(function ($q) use ($search) {
            $q->whereHas('application', function ($appQuery) use ($search) {
                $appQuery->where(function ($sub) use ($search) {
                    $sub->where('application_number', 'LIKE', "%{$search}%")
                        ->orWhere('unit_name', 'LIKE', "%{$search}%")
                        ->orWhereHas('organization', function ($orgQuery) use ($search) {
                            $orgQuery->where('name', 'LIKE', "%{$search}%");
                        });
                });
            });
        });
    }

    /**
     * Scope: Filter assessments that have at least one incomplete step.
     *
     * NOTE: This scope uses MySQL/MariaDB-specific JSON functions (JSON_UNQUOTE, JSON_EXTRACT)
     * and will not work on SQLite. It is isolated here to make it testable and to clearly
     * document the database dependency.
     */
    public function scopeHasIncompleteSteps(Builder $query): Builder
    {
        return $query->where(function ($q) {
            // Include assessments where step_progress is null (all steps pending)
            $q->whereNull('step_progress');

            // Or where any step is not 'completed'
            foreach (self::STEPS as $step) {
                $q->orWhereRaw("JSON_UNQUOTE(JSON_EXTRACT(step_progress, '$.{$step}')) != 'completed'");
            }
        });
    }

    /**
     * Scope: Filter by lead assessor.
     */
    public function scopeWithLeadAssessor(Builder $query, int $userId): Builder
    {
        return $query->whereHas('teamMembers', function ($q) use ($userId) {
            $q->where('user_id', $userId)
                ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR);
        });
    }

    /**
     * Scope: Filter by co-assessor.
     */
    public function scopeWithCoAssessor(Builder $query, int $userId): Builder
    {
        return $query->whereHas('teamMembers', function ($q) use ($userId) {
            $q->where('user_id', $userId)
                ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR);
        });
    }

    /**
     * Scope: Filter by date range on a specific date field.
     */
    public function scopeDateRange(Builder $query, string $field, ?string $from, ?string $to): Builder
    {
        if ($from) {
            $query->whereDate($field, '>=', $from);
        }

        if ($to) {
            $query->whereDate($field, '<=', $to);
        }

        return $query;
    }

    /**
     * Get the state machine class for this model.
     */
    protected function getStateMachineClass(): string
    {
        return AssessmentStateMachine::class;
    }

    // =========================================================================
    // STEP PROGRESS METHODS
    // =========================================================================

    /**
     * Initialize step progress when assessment starts.
     */
    public function initializeStepProgress(): void
    {
        $progress = [];
        foreach (self::STEPS as $step) {
            $progress[$step] = self::STEP_STATUS_PENDING;
        }

        $this->update(['step_progress' => $progress]);
    }

    /**
     * Whether this assessment is still early enough to be reset (restarted).
     */
    public function canResetExecutionData(): bool
    {
        return in_array($this->status, self::RESETTABLE_STATUSES, true);
    }

    /**
     * Wipe assessor-captured execution data so the assessment can be started
     * over from the beginning: responses (and their evidence, via FK cascade),
     * attendance, meetings (comments + participants cascade), basic information,
     * and assessor-captured site / site-tour pictures. Preserved: applicant-
     * uploaded pictures (only their assessor selection is cleared, never the
     * file) and the parameter allocation (setup, re-hydrated by the device on
     * restart). Per-member mobile-completion flags are cleared and step progress
     * is recomputed from the now-empty captures.
     *
     * Returns the disk paths of the deleted uploads so the caller can remove the
     * files best-effort — the FK cascade drops rows but never touches disk.
     */
    public function resetExecutionData(): array
    {
        return DB::transaction(function () {
            $responseIds = $this->responses()->pluck('id');
            $filePaths = collect()
                ->merge(DB::table('application_assessment_response_evidences')
                    ->whereIn('response_id', $responseIds)->pluck('file_path'))
                ->merge($this->attendances()->pluck('selfie_path'))
                ->merge($this->meetings()->pluck('image_path'))
                ->merge($this->sitePictures()->where('uploader_type', 'assessor')->pluck('file_path'))
                ->merge($this->siteTourPictures()->where('uploader_type', 'assessor')->pluck('file_path'))
                ->filter()
                ->values()
                ->all();

            // FK cascades clear response evidences and meeting comments/participants.
            $this->responses()->delete();
            $this->attendances()->delete();
            $this->meetings()->delete();
            $this->basicInformation()->delete();
            $this->sitePictures()->where('uploader_type', 'assessor')->delete();
            $this->siteTourPictures()->where('uploader_type', 'assessor')->delete();

            // Applicant-supplied pictures survive the reset; only their assessor
            // selection is cleared so the restart begins with nothing selected.
            $clearSelection = [
                'is_selected' => false,
                'selected_by_team_member_id' => null,
                'selected_at' => null,
            ];
            $this->sitePictures()->where('uploader_type', 'applicant')->update($clearSelection);
            $this->siteTourPictures()->where('uploader_type', 'applicant')->update($clearSelection);

            // Clear per-member "field work done" so the restart is clean, then
            // recompute stored step progress from the emptied captures.
            $this->teamMembers()->update(['mobile_completed_at' => null]);
            $this->recalculateStepProgress();

            return $filePaths;
        });
    }

    /**
     * Get the status of a specific step.
     */
    public function getStepStatus(string $step): string
    {
        $progress = $this->step_progress ?? [];

        return $progress[$step] ?? self::STEP_STATUS_PENDING;
    }

    /**
     * Update the status of a specific step.
     */
    public function updateStepStatus(string $step, string $status): void
    {
        $progress = $this->step_progress ?? [];
        $progress[$step] = $status;

        $this->update(['step_progress' => $progress]);
    }

    /**
     * Mark a step as completed.
     */
    public function completeStep(string $step): void
    {
        $this->updateStepStatus($step, self::STEP_STATUS_COMPLETED);
    }

    /**
     * Mark a step as in progress.
     */
    public function startStep(string $step): void
    {
        $this->updateStepStatus($step, self::STEP_STATUS_IN_PROGRESS);
    }

    /**
     * Check if a step is completed.
     */
    public function isStepCompleted(string $step): bool
    {
        return $this->getStepStatus($step) === self::STEP_STATUS_COMPLETED;
    }

    /**
     * Check if all steps are completed.
     */
    public function areAllStepsCompleted(): bool
    {
        foreach (self::STEPS as $step) {
            if (! $this->isStepCompleted($step)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Resolve a step's status from a progress map, defaulting to the stored
     * whole-team step_progress when no per-member map is supplied.
     */
    private function stepStatusFrom(?array $progress, string $step): string
    {
        $map = $progress ?? $this->step_progress ?? [];

        return $map[$step] ?? self::STEP_STATUS_PENDING;
    }

    /**
     * Get the current step (first incomplete step) for the given progress map.
     */
    public function getCurrentStep(?array $progress = null): ?string
    {
        foreach (self::STEPS as $step) {
            if ($this->stepStatusFrom($progress, $step) !== self::STEP_STATUS_COMPLETED) {
                return $step;
            }
        }

        return null;
    }

    /**
     * Get step progress summary for the given progress map.
     */
    public function getStepProgressSummary(?array $progress = null): array
    {
        $summary = [];

        foreach (self::STEPS as $step) {
            $status = $this->stepStatusFrom($progress, $step);
            $summary[] = [
                'step' => $step,
                'status' => $status,
                'is_completed' => $status === self::STEP_STATUS_COMPLETED,
            ];
        }

        return $summary;
    }

    /**
     * Calculate step completion percentage for the given progress map.
     */
    public function getStepCompletionPercentage(?array $progress = null): float
    {
        $completed = 0;

        foreach (self::STEPS as $step) {
            if ($this->stepStatusFrom($progress, $step) === self::STEP_STATUS_COMPLETED) {
                $completed++;
            }
        }

        return round(($completed / count(self::STEPS)) * 100, 2);
    }

    // =========================================================================
    // STEP VALIDATION METHODS
    // =========================================================================

    /**
     * Check if parameter allocation step is complete.
     * Complete when all mandatory parameters are assigned.
     */
    public function isParameterAllocationComplete(): bool
    {
        $mandatoryUnassigned = $this->parameters()
            ->where('is_mandatory', true)
            ->whereNull('assigned_to_team_member_id')
            ->count();

        return $mandatoryUnassigned === 0;
    }

    /**
     * Check if site pictures step is complete.
     * Complete when at least one selected picture exists. Manufacturing captures
     * are selected on upload; service-sector applicant uploads count only once an
     * assessor selects them from the pool.
     */
    public function isSitePicturesComplete(): bool
    {
        return $this->sitePictures()->where('is_selected', true)->count() > 0;
    }

    /**
     * Check if opening meeting step is complete.
     * Complete when meeting row exists with a non-empty image_path.
     */
    public function isOpeningMeetingComplete(): bool
    {
        $meeting = $this->openingMeeting;

        return $meeting && ! empty($meeting->image_path);
    }

    /**
     * Check if site tour step is complete.
     * Complete when at least one selected picture exists. Manufacturing captures
     * are selected on upload; service-sector applicant uploads count only once an
     * assessor selects them from the pool.
     */
    public function isSiteTourComplete(): bool
    {
        return $this->siteTourPictures()->where('is_selected', true)->count() > 0;
    }

    /**
     * Check if basic information step is complete.
     * Complete when basic info exists with mandatory fields filled.
     * Checks different fields based on application sector (manufacturing/service).
     */
    public function isBasicInformationComplete(): bool
    {
        $basicInfo = $this->basicInformation;

        if (! $basicInfo) {
            return false;
        }

        // Check category (common field)
        if (empty($basicInfo->category)) {
            return false;
        }

        // Check customers (common field)
        if (empty($basicInfo->customers) || ! is_array($basicInfo->customers) || count($basicInfo->customers) === 0) {
            return false;
        }

        // Check sector-specific fields
        $sector = $this->application->sector ?? 'manufacturing';

        if ($sector === 'service') {
            // Services-specific checks
            if (empty($basicInfo->svc_drdo_vendor_labs) || ! is_array($basicInfo->svc_drdo_vendor_labs)) {
                return false;
            }
            if (empty($basicInfo->svc_key_processes) || ! is_array($basicInfo->svc_key_processes)) {
                return false;
            }
            if (empty($basicInfo->svc_services) || ! is_array($basicInfo->svc_services)) {
                return false;
            }
        } else {
            // Manufacturing-specific checks
            if (empty($basicInfo->mfg_drdo_vendor_stores) || ! is_array($basicInfo->mfg_drdo_vendor_stores)) {
                return false;
            }
            if (empty($basicInfo->mfg_key_processes) || ! is_array($basicInfo->mfg_key_processes)) {
                return false;
            }
            if (empty($basicInfo->mfg_products) || ! is_array($basicInfo->mfg_products) || count($basicInfo->mfg_products) === 0) {
                return false;
            }
            // At least one of raw_materials or bought_out_parts must be filled
            $hasRawMaterials = ! empty($basicInfo->mfg_raw_materials) && is_array($basicInfo->mfg_raw_materials) && count($basicInfo->mfg_raw_materials) > 0;
            $hasBoughtOutParts = ! empty($basicInfo->mfg_bought_out_parts) && is_array($basicInfo->mfg_bought_out_parts) && count($basicInfo->mfg_bought_out_parts) > 0;
            if (! $hasRawMaterials && ! $hasBoughtOutParts) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if assessment parameters step is complete.
     * Complete when all questions for ALL assigned parameters are answered with a selected_option.
     *
     * Once a parameter is assigned (mandatory or optional), all its questions
     * become mandatory to answer for step completion.
     */
    public function isAssessmentParametersComplete(): bool
    {
        // Get ALL assigned parameters (mandatory + optional)
        // Once assigned, all questions become mandatory to answer
        $assignedParameters = $this->parameters()->assigned()->with('questions')->get();

        // No parameters assigned yet means no questions have been answered, so
        // the step has not started — it must not report as completed.
        if ($assignedParameters->isEmpty()) {
            return false;
        }

        // Pre-load all answered question IDs in a single query to avoid N+1
        $answeredQuestionIds = $this->responses()
            ->whereNotNull('selected_option')
            ->pluck('question_id')
            ->flip();

        $hasQuestions = false;
        foreach ($assignedParameters as $parameter) {
            // Check all questions for this assigned parameter are answered
            foreach ($parameter->questions as $question) {
                $hasQuestions = true;
                if (! $answeredQuestionIds->has($question->id)) {
                    return false;
                }
            }
        }

        // Assigned parameters that carry no questions leave nothing to answer —
        // that is not a completed step either.
        return $hasQuestions;
    }

    /**
     * Check if closing meeting step is complete.
     * Complete when meeting row exists with a non-empty image_path.
     */
    public function isClosingMeetingComplete(): bool
    {
        $meeting = $this->closingMeeting;

        return $meeting && ! empty($meeting->image_path);
    }

    // =========================================================================
    // PER-MEMBER STEP VALIDATION
    //
    // Site pictures, site tour and assessment parameters are each assessor's
    // OWN checklist — they capture their own data and track their own progress.
    // These mirror the global checks above but scope to one team member, so a
    // co-assessor's progress never reflects the lead's captures (and vice
    // versa). Allocation, opening/closing meeting and basic information stay
    // assessment-global. The stored step_progress (whole-team) is untouched and
    // still drives QC submission.
    // =========================================================================

    /**
     * Site pictures step complete for this member when they uploaded at least one.
     */
    public function isSitePicturesCompleteForMember(AssessmentTeamMember $member): bool
    {
        return $this->sitePictures()->where('team_member_id', $member->id)->exists();
    }

    /**
     * Site tour step complete for this member when they uploaded at least one.
     */
    public function isSiteTourCompleteForMember(AssessmentTeamMember $member): bool
    {
        return $this->siteTourPictures()->where('team_member_id', $member->id)->exists();
    }

    /**
     * Assessment parameters step complete for this member when every question
     * of the parameters assigned to THEM is answered. A member with no
     * assigned parameters has not started the step, so it is not complete.
     */
    public function isAssessmentParametersCompleteForMember(AssessmentTeamMember $member): bool
    {
        $assignedParameters = $this->parameters()
            ->where('assigned_to_team_member_id', $member->id)
            ->with('questions')
            ->get();

        if ($assignedParameters->isEmpty()) {
            return false;
        }

        $answeredQuestionIds = $this->responses()
            ->whereNotNull('selected_option')
            ->pluck('question_id')
            ->flip();

        $hasQuestions = false;
        foreach ($assignedParameters as $parameter) {
            foreach ($parameter->questions as $question) {
                $hasQuestions = true;
                if (! $answeredQuestionIds->has($question->id)) {
                    return false;
                }
            }
        }

        return $hasQuestions;
    }

    /**
     * Service-sector assessments move the site-picture and site-tour capture to
     * the applicant; several flows branch on this.
     */
    public function isServiceSector(): bool
    {
        return $this->application?->sector === 'service';
    }

    /**
     * Human-readable mode of assessment for notifications. Service-sector
     * assessments are conducted online — which is why meeting_link is mandatory
     * for them on allocation — while manufacturing is conducted at the unit.
     */
    public function modeLabel(): string
    {
        return $this->isServiceSector() ? 'Remote Assessment' : 'Onsite Assessment';
    }

    /**
     * True when the user is the applicant who owns this assessment's application
     * — the enterprise admin of its organization, or a unit admin of its unit.
     * This is who captures site pictures / site tour in the service flow.
     */
    public function isApplicantOwner(?User $user): bool
    {
        if (! $user) {
            return false;
        }

        $application = $this->application;
        if (! $application) {
            return false;
        }

        if ($user->hasRole(Role::ENTERPRISE_ADMIN) && $user->organization_id === $application->organization_id) {
            return true;
        }

        if ($user->hasRole(Role::UNIT_ADMIN)) {
            $userUnits = $user->roles()
                ->where('slug', Role::UNIT_ADMIN)
                ->wherePivot('is_active', true)
                ->get()
                ->pluck('pivot.unit_id')
                ->filter()
                ->toArray();

            if (in_array($application->unit_id, $userUnits)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Build a per-member view of step progress: the stored whole-team map with
     * the three per-assessor steps overridden by this member's own completion.
     */
    public function getStepProgressForMember(AssessmentTeamMember $member): array
    {
        $progress = $this->step_progress ?? array_combine(
            self::STEPS,
            array_fill(0, count(self::STEPS), self::STEP_STATUS_PENDING)
        );

        // In service-sector assessments the applicant (not the assessor) captures
        // the site pictures and site tour, so those steps are team-global: every
        // assessor's view reflects the applicant's single set of uploads. In
        // manufacturing each assessor captures their own, so they stay per-member.
        if ($this->isServiceSector()) {
            $progress[self::STEP_SITE_PICTURES] = $this->isSitePicturesComplete()
                ? self::STEP_STATUS_COMPLETED
                : self::STEP_STATUS_PENDING;

            $progress[self::STEP_SITE_TOUR] = $this->isSiteTourComplete()
                ? self::STEP_STATUS_COMPLETED
                : self::STEP_STATUS_PENDING;
        } else {
            $progress[self::STEP_SITE_PICTURES] = $this->isSitePicturesCompleteForMember($member)
                ? self::STEP_STATUS_COMPLETED
                : self::STEP_STATUS_PENDING;

            $progress[self::STEP_SITE_TOUR] = $this->isSiteTourCompleteForMember($member)
                ? self::STEP_STATUS_COMPLETED
                : self::STEP_STATUS_PENDING;
        }

        $progress[self::STEP_ASSESSMENT_PARAMETERS] = $this->isAssessmentParametersCompleteForMember($member)
            ? self::STEP_STATUS_COMPLETED
            : self::STEP_STATUS_PENDING;

        return $progress;
    }

    /**
     * Parameter allocation is locked the moment the lead saves it
     * (allocation_locked_at), and as a backstop once the Opening Meeting is
     * completed. Lead assessors cannot add, change, or remove assignments after
     * that point — server-enforced so the web portal and every device agree.
     */
    public function isAllocationLocked(): bool
    {
        if ($this->allocation_locked_at !== null) {
            return true;
        }

        $progress = $this->step_progress ?? [];

        return ($progress[self::STEP_OPENING_MEETING] ?? null) === self::STEP_STATUS_COMPLETED;
    }

    /**
     * True when every team member's most recent attendance event is punch_out.
     * A team member with no attendance at all counts as not punched out.
     */
    public function areAllTeamMembersPunchedOut(): bool
    {
        $teamMemberIds = $this->teamMembers()->pluck('id');
        if ($teamMemberIds->isEmpty()) {
            return false;
        }

        foreach ($teamMemberIds as $memberId) {
            $last = $this->attendances()
                ->where('team_member_id', $memberId)
                ->orderByDesc('recorded_at')
                ->first();
            if (! $last || $last->type !== ApplicationAssessmentAttendance::TYPE_PUNCH_OUT) {
                return false;
            }
        }

        return true;
    }

    /**
     * True when every team member has done their mobile cutover. This is the
     * reliable "field work is finished" signal — unlike all-punched-out, which
     * is true every evening of a multi-day assessment.
     */
    public function areAllTeamMembersMobileComplete(): bool
    {
        $members = $this->teamMembers()->get();
        if ($members->isEmpty()) {
            return false;
        }

        return $members->every(fn ($m) => $m->mobile_completed_at !== null);
    }

    /**
     * A member's most recent attendance event is a punch_out (they have left
     * site). A member with no attendance counts as not punched out.
     */
    public function isMemberPunchedOut(AssessmentTeamMember $member): bool
    {
        $last = $this->attendances()
            ->where('team_member_id', $member->id)
            ->orderByDesc('recorded_at')
            ->first();

        return $last && $last->type === ApplicationAssessmentAttendance::TYPE_PUNCH_OUT;
    }

    /**
     * The lead assessor's most recent attendance event is a punch_in (they are
     * on site). Applicant site-picture upload is gated on this. A missing lead
     * or no attendance counts as not punched in.
     */
    public function hasLeadPunchedIn(): bool
    {
        // Prefer eager-loaded relations (leadTeamMember.latestAttendance) so a
        // list of assessments resolves this without an N+1; fall back to a
        // direct query for single-assessment callers.
        $lead = $this->relationLoaded('leadTeamMember')
            ? $this->leadTeamMember
            : $this->leadTeamMember()->with('latestAttendance')->first();

        if (! $lead) {
            return false;
        }

        $last = $lead->relationLoaded('latestAttendance')
            ? $lead->latestAttendance
            : $lead->latestAttendance()->first();

        return $last && $last->type === ApplicationAssessmentAttendance::TYPE_PUNCH_IN;
    }

    /**
     * Whether this assessor may do their mobile cutover, and why not.
     *
     * Co-assessor: their own field work (site pictures, site tour, assigned
     * parameter answers) done and punched out. Lead: additionally every
     * co-assessor must already be complete and all global steps done — the lead
     * is always the last to complete, and their completion readies the whole
     * assessment for QC.
     *
     * @return array{can: bool, errors: array<string>}
     */
    public function canMemberCompleteMobile(AssessmentTeamMember $member): array
    {
        if ($member->mobile_completed_at !== null) {
            return ['can' => true, 'errors' => []];
        }

        if ($this->status !== self::STATUS_IN_PROGRESS) {
            return ['can' => false, 'errors' => ['Assessment must be in progress to complete on mobile']];
        }

        $errors = [];

        if (! $this->isMemberPunchedOut($member)) {
            $errors[] = 'You must punch out before completing on mobile';
        }

        $memberProgress = $this->getStepProgressForMember($member);
        foreach ([self::STEP_SITE_PICTURES, self::STEP_SITE_TOUR, self::STEP_ASSESSMENT_PARAMETERS] as $step) {
            if (($memberProgress[$step] ?? self::STEP_STATUS_PENDING) !== self::STEP_STATUS_COMPLETED) {
                $errors[] = "Your {$step} is not complete";
            }
        }

        if ($member->isLeadAssessor()) {
            $coPending = $this->teamMembers()
                ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR)
                ->whereNull('mobile_completed_at')
                ->count();
            if ($coPending > 0) {
                $errors[] = 'All co-assessors must complete on mobile before the lead assessor';
            }

            if (! $this->areAllStepsCompleted()) {
                $errors[] = 'All assessment steps must be complete before the lead assessor completes on mobile';
            }
        }

        return ['can' => empty($errors), 'errors' => $errors];
    }

    /**
     * Record a team member's mobile cutover. When the last member completes
     * (always the lead, gated by canMemberCompleteMobile) the assessment moves
     * to mobile_complete and QC submission unlocks on the web.
     *
     * Idempotent: re-completing an already-complete member is a no-op.
     *
     * @throws \InvalidArgumentException when the member is not yet eligible
     */
    public function markMemberMobileComplete(AssessmentTeamMember $member, ?array $metadata = null): void
    {
        $check = $this->canMemberCompleteMobile($member);
        if (! $check['can']) {
            throw new BusinessException(
                'Cannot complete on mobile: '.implode(', ', $check['errors'])
            );
        }

        // One atomic unit: the member stamp and the assessment transition must
        // land together, or a transition failure leaves the member marked
        // complete while the assessment stays in_progress.
        DB::transaction(function () use ($member, $metadata): void {
            if ($member->mobile_completed_at === null) {
                $member->forceFill([
                    'mobile_completed_at' => now(),
                    'mobile_completed_metadata' => $metadata,
                ])->save();
            }

            $this->refresh();

            if ($this->status === self::STATUS_IN_PROGRESS && $this->areAllTeamMembersMobileComplete()) {
                $this->stateMachine()->transition('complete_mobile', [
                    'remarks' => 'All team members completed on mobile; field work done',
                ]);
            }
        });
    }

    /**
     * True when every co-assessor has submitted their portion on the web. A
     * lead-only assessment (no co-assessors) is never blocked, so this returns
     * true when there are no co-assessors.
     */
    public function areAllCoAssessorsWebSubmitted(): bool
    {
        $coAssessors = $this->teamMembers()
            ->where('role', AssessmentTeamMember::ROLE_CO_ASSESSOR)
            ->get();

        if ($coAssessors->isEmpty()) {
            return true;
        }

        return $coAssessors->every(fn ($m) => $m->web_submitted_at !== null);
    }

    /**
     * Record a co-assessor's web submission. Gated on the assessment being
     * mobile_complete and the member being a co-assessor. Idempotent:
     * re-submitting an already-submitted member is a no-op.
     *
     * @throws \InvalidArgumentException when the assessment isn't mobile_complete or the member isn't a co-assessor
     */
    public function markMemberWebSubmitted(AssessmentTeamMember $member, array $metadata = []): void
    {
        if ($this->status !== self::STATUS_MOBILE_COMPLETE) {
            throw new BusinessException('Assessment must be mobile-complete before web submission.');
        }

        if (! $member->isCoAssessor()) {
            throw new BusinessException('Only co-assessors submit on web.');
        }

        if ($member->web_submitted_at !== null) {
            return;
        }

        DB::transaction(function () use ($member, $metadata): void {
            $member->forceFill([
                'web_submitted_at' => now(),
                'web_submitted_metadata' => $metadata,
            ])->save();
        });
    }

    /**
     * Recalculate and update all step statuses.
     *
     * Refreshes the model and the relations the completeness checks read so
     * the result is independent of whatever the caller did or didn't preload.
     */
    public function recalculateStepProgress(): void
    {
        $this->refresh();
        $this->load([
            'openingMeeting',
            'closingMeeting',
            'basicInformation',
            'sitePictures',
            'siteTourPictures',
            'parameters.questions',
            'responses',
        ]);

        $stepChecks = [
            self::STEP_PARAMETER_ALLOCATION => $this->isParameterAllocationComplete(),
            self::STEP_SITE_PICTURES => $this->isSitePicturesComplete(),
            self::STEP_OPENING_MEETING => $this->isOpeningMeetingComplete(),
            self::STEP_SITE_TOUR => $this->isSiteTourComplete(),
            self::STEP_BASIC_INFORMATION => $this->isBasicInformationComplete(),
            self::STEP_ASSESSMENT_PARAMETERS => $this->isAssessmentParametersComplete(),
            self::STEP_CLOSING_MEETING => $this->isClosingMeetingComplete(),
        ];

        $progress = [];
        foreach ($stepChecks as $step => $isComplete) {
            $progress[$step] = $isComplete ? self::STEP_STATUS_COMPLETED : self::STEP_STATUS_PENDING;
        }

        $this->update(['step_progress' => $progress]);
    }
}
