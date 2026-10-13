<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\State;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DistrictController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/master-data/districts",
     *     tags={"Master Data"},
     *     summary="Get list of districts",
     *     description="Retrieve a list of all districts with optional filtering and pagination",
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
     *         name="stateId",
     *         in="query",
     *         description="Filter by state ID",
     *         required=false,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="stateName",
     *         in="query",
     *         description="Filter by state name (alternative to stateId)",
     *         required=false,
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="countryId",
     *         in="query",
     *         description="Filter by country ID (through state relationship)",
     *         required=false,
     *
     *         @OA\Schema(type="integer")
     *     ),
     *
     *     @OA\Parameter(
     *         name="search",
     *         in="query",
     *         description="Search districts by name",
     *         required=false,
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="sortBy",
     *         in="query",
     *         description="Sort by field (default: name)",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"name", "code", "id"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="sortOrder",
     *         in="query",
     *         description="Sort order (default: asc)",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"asc", "desc"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number for pagination",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Number of items per page",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=15)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="name", type="string", example="Mumbai"),
     *                     @OA\Property(property="code", type="string", example="MUM"),
     *                     @OA\Property(property="state_id", type="integer", example=1),
     *                     @OA\Property(
     *                         property="state",
     *                         type="object",
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="name", type="string", example="Maharashtra"),
     *                         @OA\Property(property="code", type="string", example="MH"),
     *                         @OA\Property(
     *                             property="country",
     *                             type="object",
     *                             @OA\Property(property="id", type="integer", example=101),
     *                             @OA\Property(property="name", type="string", example="India"),
     *                             @OA\Property(property="code", type="string", example="IN")
     *                         )
     *                     ),
     *                     @OA\Property(property="created_at", type="string", format="date-time"),
     *                     @OA\Property(property="updated_at", type="string", format="date-time")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Bad request - conflicting parameters"),
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = District::query()->with('state.country');

        // Filter by state ID or state name
        if ($request->has('state_id')) {
            $query->where('state_id', $request->state_id);
        } elseif ($request->has('state_name')) {
            // Get state id from state name
            $state = State::where('name', 'like', '%'.$request->state_name.'%')->first();
            if ($state) {
                $query->where('state_id', $state->id);
            }
        }

        // Filter by country (through state relationship)
        if ($request->has('country_id')) {
            $query->whereHas('state', function ($q) use ($request) {
                $q->where('country_id', $request->country_id);
            });
        }

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'like', '%'.$request->search.'%');
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        return $this->listResponse(
            $request,
            $query,
            null,
            'Districts retrieved successfully',
            15,
            2000 // Districts dataset can be large, allow up to 2000
        );
    }
}
