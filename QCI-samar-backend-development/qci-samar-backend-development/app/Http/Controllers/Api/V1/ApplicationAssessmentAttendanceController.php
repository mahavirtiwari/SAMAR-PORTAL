<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentAttendance;
use App\Models\Assessment;
use App\Services\FileStorageService;
use App\Traits\AuthorizesAssessmentAccess;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Application Assessment Attendance",
 *     description="Punch-in/punch-out tracking for assessors during on-site assessments. This is NOT a step - it runs parallel to assessment steps."
 * )
 */
class ApplicationAssessmentAttendanceController extends Controller
{
    use AuthorizesAssessmentAccess;

    protected FileStorageService $fileStorage;

    public function __construct(FileStorageService $fileStorage)
    {
        $this->fileStorage = $fileStorage;
    }

    /**
     * Get attendance records for an assessment.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/attendance",
     *     summary="List all attendance records",
     *     description="Retrieves all punch-in and punch-out records for an assessment, including a summary showing current status of each team member.",
     *     tags={"Application Assessment Attendance", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Attendance records retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="attendances",
     *                     type="array",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="type", type="string", enum={"punch_in", "punch_out"}, example="punch_in"),
     *                         @OA\Property(property="selfie_path", type="string", example="assessments/1/attendance/selfie.jpg"),
     *                         @OA\Property(property="latitude", type="number", format="float", example=28.6139),
     *                         @OA\Property(property="longitude", type="number", format="float", example=77.2090),
     *                         @OA\Property(property="recorded_at", type="string", format="date-time")
     *                     )
     *                 ),
     *                 @OA\Property(
     *                     property="summary",
     *                     type="array",
     *                     description="Summary of each team member's attendance status",
     *
     *                     @OA\Items(
     *                         type="object",
     *
     *                         @OA\Property(property="team_member_id", type="integer"),
     *                         @OA\Property(property="is_punched_in", type="boolean"),
     *                         @OA\Property(property="last_action", type="string", enum={"punch_in", "punch_out"}, nullable=true),
     *                         @OA\Property(property="last_action_at", type="string", format="date-time", nullable=true)
     *                     )
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=404, description="Assessment not found")
     * )
     */
    public function index(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $attendances = $assessment->attendances()
            ->with(['teamMember.user'])
            ->orderBy('recorded_at', 'desc')
            ->get();

        return $this->successResponse([
            'attendances' => $attendances,
            'summary' => $this->getAttendanceSummary($assessment),
        ], 'Attendance records retrieved successfully');
    }

    /**
     * Record punch-in for current user.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/attendance/punch-in",
     *     summary="Record punch-in",
     *     description="Records a punch-in for the current user. Requires a selfie image with GPS coordinates. User must be a team member of the assessment and not already punched in.",
     *     tags={"Application Assessment Attendance", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *                 required={"selfie", "recordedAt"},
     *
     *                 @OA\Property(property="selfie", type="string", format="binary", description="Selfie image file (max 5MB)"),
     *                 @OA\Property(property="recordedAt", type="string", format="date-time", example="2026-06-10T09:15:00Z", description="Device capture time of the punch (required — stored as recorded_at; never defaults to server time)"),
     *                 @OA\Property(property="clientUuid", type="string", maxLength=64, description="Idempotency key — a replay with the same value returns the already-recorded punch"),
     *                 @OA\Property(property="latitude", type="number", format="float", example=28.6139, description="GPS latitude (-90 to 90)"),
     *                 @OA\Property(property="longitude", type="number", format="float", example=77.2090, description="GPS longitude (-180 to 180)"),
     *                 @OA\Property(
     *                     property="device_metadata",
     *                     type="object",
     *                     description="Optional device information",
     *                     @OA\Property(property="device_model", type="string", example="iPhone 14"),
     *                     @OA\Property(property="os_version", type="string", example="iOS 17.0"),
     *                     @OA\Property(property="app_version", type="string", example="1.0.0")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Punch-in recorded successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Punch-in recorded successfully"),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Already punched in",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="You have already punched in. Please punch out first.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Not a team member",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="You are not a team member of this assessment")
     *         )
     *     ),
     *
     *     @OA\Response(response=409, description="The punch key is already in use by another record")
     * )
     */
    public function punchIn(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        if (! in_array($assessment->status, [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS], true)) {
            return $this->errorResponse('Attendance can only be recorded when assessment is scheduled or in progress', 400);
        }

        // Idempotency: an offline replay carries the same client_uuid. Return the
        // already-recorded punch (before the "already punched in" guard would
        // otherwise reject it) so a lost-response retry is a safe no-op.
        $clientUuid = $request->input('client_uuid');
        if ($clientUuid) {
            $existing = $assessment->attendances()
                ->where('team_member_id', $teamMember->id)
                ->where('type', ApplicationAssessmentAttendance::TYPE_PUNCH_IN)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($existing) {
                return $this->successResponse(
                    $existing->load('teamMember.user'),
                    'Punch-in recorded successfully',
                    201
                );
            }
        }

        // Co-assessors may punch in at any time. The opening-meeting precondition
        // was removed so a co-assessor can start fully offline without first
        // syncing the lead's opening meeting from another device.

        $lastAttendance = $assessment->attendances()
            ->where('team_member_id', $teamMember->id)
            ->orderBy('recorded_at', 'desc')
            ->first();

        if ($lastAttendance && $lastAttendance->type === ApplicationAssessmentAttendance::TYPE_PUNCH_IN) {
            return $this->errorResponse('You have already punched in. Please punch out first.', 400);
        }

        $validator = Validator::make($request->all(), [
            'selfie' => 'required|image|max:5120',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'device_metadata' => 'nullable|array',
            'client_uuid' => 'nullable|string|max:64',
            'recorded_at' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $storedSelfiePath = null;
        DB::beginTransaction();
        try {
            $selfieData = $this->fileStorage->storeAssessmentFile(
                $request->file('selfie'),
                $assessmentId,
                FileStorageService::ASSESSMENT_ATTENDANCE
            );
            $storedSelfiePath = $selfieData['path'];

            $attendance = ApplicationAssessmentAttendance::create([
                'assessment_id' => $assessmentId,
                'team_member_id' => $teamMember->id,
                'client_uuid' => $clientUuid,
                'type' => ApplicationAssessmentAttendance::TYPE_PUNCH_IN,
                'selfie_path' => $selfieData['path'],
                'disk' => $selfieData['disk'],
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                // Offline-first capture: the device may sync hours after the
                // punch happened. The capture time is required — attendance
                // must reflect on-site presence, never sync time.
                'recorded_at' => $request->input('recorded_at'),
                'device_metadata' => $request->device_metadata,
            ]);

            DB::commit();

            return $this->successResponse(
                $attendance->load('teamMember.user'),
                'Punch-in recorded successfully',
                201
            );
        } catch (UniqueConstraintViolationException $e) {
            DB::rollBack();
            // The row was not written, so the selfie stored a moment ago has no
            // owner; remove it rather than leave an orphan in the evidence store.
            if ($storedSelfiePath) {
                $this->fileStorage->delete($storedSelfiePath);
            }
            // Two replays of the same client_uuid can pass the idempotency lookup
            // above concurrently; the loser hits the unique key. It is still the
            // same punch, so answer exactly as the lookup would have.
            $existing = $clientUuid
                ? $assessment->attendances()
                    ->where('team_member_id', $teamMember->id)
                    ->where('type', ApplicationAssessmentAttendance::TYPE_PUNCH_IN)
                    ->where('client_uuid', $clientUuid)
                    ->first()
                : null;
            if ($existing) {
                return $this->successResponse(
                    $existing->load('teamMember.user'),
                    'Punch-in recorded successfully',
                    201
                );
            }

            // The key collided with a row that is not this member's punch-in:
            // the client sent a key it does not own, which is a conflict, not a
            // server fault. The unique index is table-wide on client_uuid while
            // idempotency is scoped per member, so this branch stays reachable
            // until the index is made composite on (team_member_id, client_uuid).
            return $this->errorResponse('This punch-in key is already in use.', 409);
        } catch (\Exception $e) {
            DB::rollBack();
            if ($storedSelfiePath) {
                $this->fileStorage->delete($storedSelfiePath);
            }

            return $this->serverErrorResponse($e, 'Failed to record punch-in');
        }
    }

    /**
     * Record punch-out for current user.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/attendance/punch-out",
     *     summary="Record punch-out",
     *     description="Records a punch-out for the current user. User must have punched in first.",
     *     tags={"Application Assessment Attendance", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *
     *             @OA\Schema(
     *                 required={"selfie", "recordedAt"},
     *
     *                 @OA\Property(property="selfie", type="string", format="binary", description="Selfie image file (max 5MB)"),
     *                 @OA\Property(property="recordedAt", type="string", format="date-time", example="2026-06-10T17:45:00Z", description="Device capture time of the punch (required — stored as recorded_at; never defaults to server time)"),
     *                 @OA\Property(property="clientUuid", type="string", maxLength=64, description="Idempotency key — a replay with the same value returns the already-recorded punch"),
     *                 @OA\Property(property="latitude", type="number", format="float", example=28.6139),
     *                 @OA\Property(property="longitude", type="number", format="float", example=77.2090),
     *                 @OA\Property(property="device_metadata", type="object")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Punch-out recorded successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Punch-out recorded successfully")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Not punched in",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="You must punch in before punching out.")
     *         )
     *     ),
     *
     *     @OA\Response(response=403, description="Not a team member"),
     *     @OA\Response(response=409, description="The punch key is already in use by another record")
     * )
     */
    public function punchOut(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        if (! in_array($assessment->status, [Assessment::STATUS_SCHEDULED, Assessment::STATUS_IN_PROGRESS], true)) {
            return $this->errorResponse('Attendance can only be recorded when assessment is scheduled or in progress', 400);
        }

        // Idempotency: an offline replay carries the same client_uuid. Return the
        // already-recorded punch-out (before the "must punch in first" guard
        // would otherwise reject it) so a lost-response retry is a safe no-op.
        $clientUuid = $request->input('client_uuid');
        if ($clientUuid) {
            $existing = $assessment->attendances()
                ->where('team_member_id', $teamMember->id)
                ->where('type', ApplicationAssessmentAttendance::TYPE_PUNCH_OUT)
                ->where('client_uuid', $clientUuid)
                ->first();
            if ($existing) {
                return $this->successResponse(
                    $existing->load('teamMember.user'),
                    'Punch-out recorded successfully',
                    201
                );
            }
        }

        $lastAttendance = $assessment->attendances()
            ->where('team_member_id', $teamMember->id)
            ->orderBy('recorded_at', 'desc')
            ->first();

        if (! $lastAttendance || $lastAttendance->type !== ApplicationAssessmentAttendance::TYPE_PUNCH_IN) {
            return $this->errorResponse('You must punch in before punching out.', 400);
        }

        $validator = Validator::make($request->all(), [
            'selfie' => 'required|image|max:5120',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'device_metadata' => 'nullable|array',
            'client_uuid' => 'nullable|string|max:64',
            'recorded_at' => 'required|date',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        $storedSelfiePath = null;
        DB::beginTransaction();
        try {
            // Store selfie using FileStorageService (private storage)
            $fileData = $this->fileStorage->storeAssessmentFile(
                $request->file('selfie'),
                $assessmentId,
                FileStorageService::ASSESSMENT_ATTENDANCE
            );
            $storedSelfiePath = $fileData['path'];

            $attendance = ApplicationAssessmentAttendance::create([
                'assessment_id' => $assessmentId,
                'team_member_id' => $teamMember->id,
                'client_uuid' => $clientUuid,
                'type' => ApplicationAssessmentAttendance::TYPE_PUNCH_OUT,
                'selfie_path' => $fileData['path'],
                'disk' => $fileData['disk'],
                'latitude' => $request->latitude,
                'longitude' => $request->longitude,
                // Offline-first capture: the device's capture time is
                // required (see punchIn) — punch-out reflects when the
                // assessor actually left, never sync time.
                'recorded_at' => $request->input('recorded_at'),
                'device_metadata' => $request->device_metadata,
            ]);

            DB::commit();

            return $this->successResponse(
                $attendance->load('teamMember.user'),
                'Punch-out recorded successfully',
                201
            );
        } catch (UniqueConstraintViolationException $e) {
            DB::rollBack();
            // The row was not written, so the selfie stored a moment ago has no
            // owner; remove it rather than leave an orphan in the evidence store.
            if ($storedSelfiePath) {
                $this->fileStorage->delete($storedSelfiePath);
            }
            // Two replays of the same client_uuid can pass the idempotency lookup
            // above concurrently; the loser hits the unique key. It is still the
            // same punch, so answer exactly as the lookup would have.
            $existing = $clientUuid
                ? $assessment->attendances()
                    ->where('team_member_id', $teamMember->id)
                    ->where('type', ApplicationAssessmentAttendance::TYPE_PUNCH_OUT)
                    ->where('client_uuid', $clientUuid)
                    ->first()
                : null;
            if ($existing) {
                return $this->successResponse(
                    $existing->load('teamMember.user'),
                    'Punch-out recorded successfully',
                    201
                );
            }

            // The key collided with a row that is not this member's punch-out:
            // the client sent a key it does not own, which is a conflict, not a
            // server fault. The unique index is table-wide on client_uuid while
            // idempotency is scoped per member, so this branch stays reachable
            // until the index is made composite on (team_member_id, client_uuid).
            return $this->errorResponse('This punch-out key is already in use.', 409);
        } catch (\Exception $e) {
            DB::rollBack();
            if ($storedSelfiePath) {
                $this->fileStorage->delete($storedSelfiePath);
            }

            return $this->serverErrorResponse($e, 'Failed to record punch-out');
        }
    }

    /**
     * Get current user's attendance status.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/attendance/my-status",
     *     summary="Get my attendance status",
     *     description="Returns the current user's punch-in/punch-out status and attendance history for this assessment.",
     *     tags={"Application Assessment Attendance", "Assessor - Assessment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="assessmentId",
     *         in="path",
     *         required=true,
     *         description="Assessment ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Attendance status retrieved",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="is_punched_in", type="boolean", example=true, description="Whether user is currently punched in"),
     *                 @OA\Property(property="last_attendance", type="object", nullable=true, description="Last attendance record"),
     *                 @OA\Property(property="attendance_history", type="array", @OA\Items(type="object"), description="All attendance records for this user")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=403, description="Not a team member")
     * )
     */
    public function myStatus(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::findOrFail($assessmentId);
        $user = $request->user();

        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('You are not a team member of this assessment', 403);
        }

        $lastAttendance = $assessment->attendances()
            ->where('team_member_id', $teamMember->id)
            ->orderBy('recorded_at', 'desc')
            ->first();

        $isPunchedIn = $lastAttendance && $lastAttendance->type === ApplicationAssessmentAttendance::TYPE_PUNCH_IN;

        $myAttendances = $assessment->attendances()
            ->where('team_member_id', $teamMember->id)
            ->orderBy('recorded_at', 'desc')
            ->get();

        return $this->successResponse([
            'is_punched_in' => $isPunchedIn,
            'last_attendance' => $lastAttendance,
            'attendance_history' => $myAttendances,
        ], 'Attendance status retrieved successfully');
    }

    /**
     * Stream or download an attendance selfie.
     */
    public function selfie(Request $request, int $assessmentId, int $attendanceId)
    {
        // A selfie is a photograph of a person, so the assessment is loaded and
        // authorised before the file is served — the attendance row alone proves
        // only that the record belongs to this assessment, not that the caller
        // may see it.
        $assessment = Assessment::findOrFail($assessmentId);

        if ($denied = $this->denyUnlessAssessmentVisible($request, $assessment)) {
            return $denied;
        }

        $attendance = ApplicationAssessmentAttendance::where('id', $attendanceId)
            ->where('assessment_id', $assessmentId)
            ->first();

        if (! $attendance) {
            return $this->errorResponse('Attendance record not found.', 404);
        }

        if (! $attendance->selfie_path || ! $this->fileStorage->exists($attendance->selfie_path)) {
            return $this->errorResponse('Selfie not found in storage.', 404);
        }

        $forceDownload = $request->boolean('download', false);

        if ($forceDownload) {
            return $this->fileStorage->download($attendance->selfie_path, basename($attendance->selfie_path));
        }

        return $this->fileStorage->stream($attendance->selfie_path, basename($attendance->selfie_path));
    }

    /**
     * Get attendance summary for assessment.
     */
    private function getAttendanceSummary(Assessment $assessment): array
    {
        $teamMembers = $assessment->teamMembers()->with('user')->get();
        $summary = [];

        foreach ($teamMembers as $member) {
            $lastAttendance = $assessment->attendances()
                ->where('team_member_id', $member->id)
                ->orderBy('recorded_at', 'desc')
                ->first();

            $summary[] = [
                'team_member_id' => $member->id,
                'user' => $member->user,
                'role' => $member->role,
                'is_punched_in' => $lastAttendance && $lastAttendance->type === ApplicationAssessmentAttendance::TYPE_PUNCH_IN,
                'last_action' => $lastAttendance?->type,
                'last_action_at' => $lastAttendance?->recorded_at,
            ];
        }

        return $summary;
    }
}
