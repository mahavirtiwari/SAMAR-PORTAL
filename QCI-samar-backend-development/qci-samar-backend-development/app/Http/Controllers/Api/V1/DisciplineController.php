<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Discipline\DisciplineExportRequest;
use App\Http\Requests\Discipline\StoreDisciplineRequest;
use App\Http\Requests\Discipline\UpdateDisciplineRequest;
use App\Http\Resources\DisciplineResource;
use App\Models\Discipline;
use App\Support\Csv;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @OA\Tag(
 *     name="Disciplines",
 *     description="Discipline management endpoints"
 * )
 */
class DisciplineController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/disciplines",
     *     summary="List all disciplines",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="all",
     *         in="query",
     *         description="Return all records without pagination (for dropdowns). Cannot be used with page/per_page parameters.",
     *         required=false,
     *
     *         @OA\Schema(type="boolean", default=false, example=true)
     *     ),
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by name",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Filter by sector",
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="isActive",
     *         in="query",
     *         description="Filter by active status",
     *
     *         @OA\Schema(type="boolean")
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Items per page",
     *
     *         @OA\Schema(type="integer", default=15)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Disciplines retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - conflicting parameters"
     *     ),
     *     @OA\Response(
     *         response=401,
     *         description="Unauthorized"
     *     )
     * )
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $query = Discipline::query()
                ->withCount(['parameters', 'questions']);

            if ($request->filled('search')) {
                $query->search($request->search);
            }

            if ($request->filled('sector')) {
                $query->where('sector', $request->sector);
            }

            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Order by name
            $query->orderBy('name');

            return $this->listResponse(
                $request,
                $query,
                DisciplineResource::class,
                'Disciplines retrieved successfully',
                15,
                500 // Disciplines dataset is moderate, allow up to 500
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve disciplines');
        }
    }

    /**
     * @OA\Post(
     *     path="/api/v1/disciplines",
     *     summary="Create a new discipline",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"name", "sector"},
     *
     *             @OA\Property(property="name", type="string", example="Leadership & Management"),
     *             @OA\Property(property="sector", type="string", enum={"manufacturing", "service"}, example="manufacturing")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Discipline created successfully"
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden"
     *     )
     * )
     */
    public function store(StoreDisciplineRequest $request): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to create disciplines', 403);
            }

            $data = $request->validated();
            $data['created_by'] = $user->id;

            $discipline = Discipline::create($data);

            return $this->successResponse($discipline, 'Discipline created successfully', 201);
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to create discipline');
        }
    }

    /**
     * @OA\Get(
     *     path="/api/v1/disciplines/{id}",
     *     summary="Get discipline details with parameters",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="includeParameters",
     *         in="query",
     *         description="Include related parameters",
     *
     *         @OA\Schema(type="boolean", default=false)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Discipline retrieved successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Discipline not found"
     *     )
     * )
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $query = Discipline::query();

            // Optionally include parameters
            if ($request->boolean('include_parameters', false)) {
                $query->with('parameters');
            }

            $discipline = $query->findOrFail($id);

            return $this->successResponse($discipline, 'Discipline retrieved successfully');
        } catch (\Exception $e) {
            return $this->errorResponse('Discipline not found', 404);
        }
    }

    /**
     * @OA\Put(
     *     path="/api/v1/disciplines/{id}",
     *     summary="Update a discipline",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="name", type="string"),
     *             @OA\Property(property="sector", type="string", enum={"manufacturing", "service"})
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Discipline updated successfully"
     *     ),
     *     @OA\Response(
     *         response=404,
     *         description="Discipline not found"
     *     ),
     *     @OA\Response(
     *         response=403,
     *         description="Forbidden"
     *     )
     * )
     */
    public function update(UpdateDisciplineRequest $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();

            // Check authorization
            if (! $user->hasAnyRole(['system_admin', 'drdo_admin'])) {
                return $this->errorResponse('Unauthorized to update disciplines', 403);
            }

            $discipline = Discipline::findOrFail($id);

            $data = $request->validated();
            $data['updated_by'] = $user->id;

            $discipline->update($data);

            return $this->successResponse($discipline, 'Discipline updated successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to update discipline');
        }
    }

    /**
     * @OA\Patch(
     *     path="/api/v1/disciplines/{id}/activate",
     *     summary="Activate a discipline",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Discipline ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Discipline activated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Discipline activated successfully."),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Discipline is already active"),
     *     @OA\Response(response=403, description="Unauthorized"),
     *     @OA\Response(response=404, description="Discipline not found")
     * )
     */
    public function activate(int $id): JsonResponse
    {
        try {
            $discipline = Discipline::findOrFail($id);
            Gate::authorize('changeStatus', $discipline);

            if ($discipline->is_active === true) {
                return $this->errorResponse('Discipline is already active.', 400);
            }

            $discipline->update(['is_active' => true]);

            Log::info('Discipline activated', [
                'discipline_id' => $discipline->id,
                'activated_by' => auth()->id(),
            ]);

            return $this->successResponse($discipline, 'Discipline activated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Discipline not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to activate discipline', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'discipline_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to activate discipline.', 500);
        }
    }

    /**
     * @OA\Patch(
     *     path="/api/v1/disciplines/{id}/deactivate",
     *     summary="Deactivate a discipline",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         required=true,
     *         description="Discipline ID",
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Discipline deactivated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Discipline deactivated successfully."),
     *             @OA\Property(property="data", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Discipline is already inactive"),
     *     @OA\Response(response=403, description="Unauthorized"),
     *     @OA\Response(response=404, description="Discipline not found")
     * )
     */
    public function deactivate(int $id): JsonResponse
    {
        try {
            $discipline = Discipline::findOrFail($id);
            Gate::authorize('changeStatus', $discipline);

            if ($discipline->is_active === false) {
                return $this->errorResponse('Discipline is already inactive.', 400);
            }

            $discipline->update(['is_active' => false]);

            Log::info('Discipline deactivated', [
                'discipline_id' => $discipline->id,
                'deactivated_by' => auth()->id(),
            ]);

            return $this->successResponse($discipline, 'Discipline deactivated successfully.');
        } catch (ModelNotFoundException $e) {
            return $this->errorResponse('Discipline not found.', 404);
        } catch (AuthorizationException $e) {
            return $this->errorResponse('This action is unauthorized.', 403);
        } catch (\Exception $e) {
            Log::error('Failed to deactivate discipline', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'discipline_id' => $id,
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to deactivate discipline.', 500);
        }
    }

    /**
     * @OA\Get(
     *     path="/api/v1/disciplines/export",
     *     summary="Export disciplines to CSV",
     *     tags={"Disciplines", "System Admin - Disciplines", "DRDO Admin - Disciplines"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Filter by sector",
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search by name",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="is_active",
     *         in="query",
     *         description="Filter by active status",
     *
     *         @OA\Schema(type="boolean")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="CSV file download",
     *
     *         @OA\MediaType(
     *             mediaType="text/csv"
     *         )
     *     ),
     *
     *     @OA\Response(response=403, description="Unauthorized"),
     *     @OA\Response(response=500, description="Server error")
     * )
     */
    public function export(DisciplineExportRequest $request): StreamedResponse|JsonResponse
    {
        Gate::authorize('viewAny', Discipline::class);

        try {
            $query = Discipline::query()
                ->withCount(['parameters', 'questions']);

            // Apply search filter
            if ($request->filled('search')) {
                $search = trim($request->input('search'));
                $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
                $query->where('name', 'LIKE', "%{$search}%");
            }

            // Apply sector filter
            if ($request->filled('sector')) {
                $query->where('sector', $request->input('sector'));
            }

            // Apply is_active filter
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            }

            // Order by name
            $query->orderBy('name', 'asc');

            // Get all disciplines
            $disciplines = $query->get();

            // Generate CSV
            $filename = 'disciplines_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            $callback = function () use ($disciplines) {
                $file = fopen('php://output', 'w');

                // Add BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                // CSV Headers
                fputcsv($file, [
                    'ID',
                    'Name',
                    'Sector',
                    'Parameters Count',
                    'Questions Count',
                    'Status',
                    'Created At',
                ]);

                foreach ($disciplines as $discipline) {
                    Csv::putRow($file, [
                        $discipline->id,
                        $discipline->name,
                        ucfirst($discipline->sector),
                        $discipline->parameters_count ?? 0,
                        $discipline->questions_count ?? 0,
                        $discipline->is_active ? 'Active' : 'Inactive',
                        $discipline->created_at->toDateString(),
                    ]);
                }

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export disciplines', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => auth()->id(),
            ]);

            return $this->errorResponse('Failed to export disciplines.', 500);
        }
    }
}
