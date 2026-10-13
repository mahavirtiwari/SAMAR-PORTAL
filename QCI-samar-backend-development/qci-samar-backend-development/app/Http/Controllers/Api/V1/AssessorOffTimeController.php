<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assessment;
use App\Models\AssessorOffTime;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Assessor Off-Time",
 *     description="Assessors log off-time (unavailable) date ranges; Operations Manager can view them read-only."
 * )
 */
class AssessorOffTimeController extends Controller
{
    /**
     * Upper bound on a batched off-time request, so the endpoint that exists to save
     * requests cannot itself be turned into an unbounded query.
     */
    private const MAX_ASSESSORS_PER_REQUEST = 200;

    /**
     * List the authenticated assessor's own off-time entries.
     *
     * @OA\Get(
     *     path="/api/v1/off-times",
     *     summary="List my off-time entries",
     *     tags={"Assessor Off-Time"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Response(response=200, description="Off-time entries retrieved successfully"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $offTimes = AssessorOffTime::where('user_id', $request->user()->id)
            ->orderBy('from_date')
            ->get();

        return $this->successResponse(
            ['off_times' => $offTimes->map(fn ($offTime) => $this->formatOffTime($offTime))->values()],
            'Off-time entries retrieved successfully'
        );
    }

    /**
     * Create an off-time entry for the authenticated assessor.
     *
     * @OA\Post(
     *     path="/api/v1/off-times",
     *     summary="Log an off-time date range",
     *     tags={"Assessor Off-Time"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"fromDate", "toDate"},
     *
     *             @OA\Property(property="fromDate", type="string", format="date", example="2026-08-01"),
     *             @OA\Property(property="toDate", type="string", format="date", example="2026-08-05")
     *         )
     *     ),
     *
     *     @OA\Response(response=201, description="Off-time entry created successfully"),
     *     @OA\Response(response=422, description="Validation failed or assessor already booked for the dates"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'from_date' => 'required|date_format:Y-m-d|after_or_equal:today',
            'to_date' => 'required|date_format:Y-m-d|after_or_equal:from_date',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        $user = $request->user();

        // Model this on the assessor double-booking check in
        // AssessmentController::allocate() — inclusive date overlap against any
        // scheduled/in_progress assessment this assessor is a team member of.
        $hasConflict = Assessment::query()
            ->whereIn('status', [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS])
            ->whereNotNull('scheduled_start_date')
            ->whereNotNull('scheduled_end_date')
            ->whereDate('scheduled_start_date', '<=', $request->to_date)
            ->whereDate('scheduled_end_date', '>=', $request->from_date)
            ->whereHas('teamMembers', fn ($q) => $q->where('user_id', $user->id))
            ->exists();

        if ($hasConflict) {
            return $this->errorResponse(
                'You are already booked for the entered dates. Cannot log off-time entries for the said dates.',
                422
            );
        }

        $offTime = AssessorOffTime::create([
            'user_id' => $user->id,
            'from_date' => $request->from_date,
            'to_date' => $request->to_date,
        ]);

        return $this->successResponse($this->formatOffTime($offTime), 'Off-time entry created successfully', 201);
    }

    /**
     * Delete a future off-time entry owned by the authenticated assessor.
     *
     * @OA\Delete(
     *     path="/api/v1/off-times/{id}",
     *     summary="Delete an off-time entry",
     *     tags={"Assessor Off-Time"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Off-time entry deleted successfully"),
     *     @OA\Response(response=404, description="Off-time entry not found"),
     *     @OA\Response(response=422, description="Only upcoming off-time entries can be deleted"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $offTime = AssessorOffTime::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->first();

        if (! $offTime) {
            return $this->errorResponse('Off-time entry not found.', 404);
        }

        if ($offTime->from_date->lte(today())) {
            return $this->errorResponse('Only upcoming off-time entries can be deleted.', 422);
        }

        $offTime->delete();

        return $this->successResponse(null, 'Off-time entry deleted successfully');
    }

    /**
     * Read-only list of an assessor's off-time entries, for Operations Manager
     * viewing that assessor's profile.
     *
     * @OA\Get(
     *     path="/api/v1/users/{id}/off-times",
     *     summary="List an assessor's off-time entries (Operations Manager, read-only)",
     *     tags={"Assessor Off-Time"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(name="id", in="path", required=true, description="Assessor user ID", @OA\Schema(type="integer")),
     *
     *     @OA\Response(response=200, description="Off-time entries retrieved successfully"),
     *     @OA\Response(response=404, description="Assessor not found"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function forAssessor(int $id): JsonResponse
    {
        $assessor = User::find($id);

        if (! $assessor) {
            return $this->errorResponse('Assessor not found.', 404);
        }

        $offTimes = AssessorOffTime::where('user_id', $id)
            ->orderBy('from_date')
            ->get();

        return $this->successResponse(
            ['off_times' => $offTimes->map(fn ($offTime) => $this->formatOffTime($offTime))->values()],
            'Off-time entries retrieved successfully'
        );
    }

    /**
     * Off-time entries for several assessors in one call.
     *
     * The scheduling screen needs every eligible assessor's off-time at once. Asking
     * per assessor cost one request each and exhausted the caller's per-minute
     * allowance on a large list, which then refused their unrelated requests too.
     * Entries come back as one flat list carrying user_id, so the client groups them
     * itself and no response key is ever a user id. [BUG-08860]
     *
     * @OA\Get(
     *     path="/api/v1/users/off-times",
     *     summary="List off-time entries for several assessors",
     *     tags={"Assessor Off-Time"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="userIds",
     *         in="query",
     *         required=true,
     *         description="Assessor user IDs, as userIds[]=1&userIds[]=2 or a comma-separated list. Camel case is the wire contract: ConvertRequestToSnakeCase refuses a literal snake_case key and converts this one server-side.",
     *
     *         @OA\Schema(type="array", @OA\Items(type="integer"))
     *     ),
     *
     *     @OA\Response(response=200, description="Off-time entries retrieved successfully"),
     *     @OA\Response(response=422, description="Validation failed"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function forAssessors(Request $request): JsonResponse
    {
        $userIds = $request->input('user_ids', []);

        // Accept both userIds[]=1&userIds[]=2 and userIds=1,2, since query strings reach
        // us in either shape depending on how the client builds them. The key arrives
        // camel case and ConvertRequestToSnakeCase rewrites it to user_ids before we
        // read it; a literal snake_case key is refused by that middleware.
        if (is_string($userIds)) {
            $userIds = array_filter(explode(',', $userIds), fn ($id) => $id !== '');
        }

        $validator = Validator::make(['user_ids' => $userIds], [
            'user_ids' => ['required', 'array', 'min:1', 'max:'.self::MAX_ASSESSORS_PER_REQUEST],
            'user_ids.*' => ['integer'],
        ], [
            'user_ids.max' => 'At most '.self::MAX_ASSESSORS_PER_REQUEST.' assessors can be requested at once.',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        $userIds = array_values(array_unique(array_map('intval', $userIds)));

        $offTimes = AssessorOffTime::whereIn('user_id', $userIds)
            ->orderBy('user_id')
            ->orderBy('from_date')
            ->get();

        return $this->successResponse(
            [
                'off_times' => $offTimes
                    ->map(fn ($offTime) => $this->formatOffTime($offTime) + ['user_id' => $offTime->user_id])
                    ->values(),
            ],
            'Off-time entries retrieved successfully'
        );
    }

    /**
     * Format an off-time entry for API output with plain Y-m-d dates.
     */
    private function formatOffTime(AssessorOffTime $offTime): array
    {
        return [
            'id' => $offTime->id,
            'from_date' => $offTime->from_date->format('Y-m-d'),
            'to_date' => $offTime->to_date->format('Y-m-d'),
            'created_at' => $offTime->created_at?->toIso8601String(),
        ];
    }
}
