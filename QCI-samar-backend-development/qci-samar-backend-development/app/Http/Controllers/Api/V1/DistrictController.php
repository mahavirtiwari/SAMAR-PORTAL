<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\State;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class DistrictController extends Controller
{
    #[OA\Get(
        path: '/api/v1/master-data/districts',
        tags: ['Master Data'],
        summary: 'Get list of districts',
        description: 'Retrieve a list of all districts with optional filtering and pagination',
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'all',
                in: 'query',
                description: 'Return all records without pagination (for dropdowns). Cannot be used with page/per_page parameters.',
                required: false,
                schema: new OA\Schema(type: 'boolean', default: false, example: true),
            ),
            new OA\Parameter(
                name: 'stateId',
                in: 'query',
                description: 'Filter by state ID',
                required: false,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'stateName',
                in: 'query',
                description: 'Filter by state name (alternative to stateId)',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'countryId',
                in: 'query',
                description: 'Filter by country ID (through state relationship)',
                required: false,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search districts by name',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'sortBy',
                in: 'query',
                description: 'Sort by field (default: name)',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['name', 'code', 'id']),
            ),
            new OA\Parameter(
                name: 'sortOrder',
                in: 'query',
                description: 'Sort order (default: asc)',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['asc', 'desc']),
            ),
            new OA\Parameter(
                name: 'page',
                in: 'query',
                description: 'Page number for pagination',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 1),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', default: 15),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Successful operation',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'array',
                            items: new OA\Items(
                                properties: [
                                    new OA\Property(property: 'id', type: 'integer', example: 1),
                                    new OA\Property(property: 'name', type: 'string', example: 'Mumbai'),
                                    new OA\Property(property: 'code', type: 'string', example: 'MUM'),
                                    new OA\Property(property: 'state_id', type: 'integer', example: 1),
                                    new OA\Property(
                                        property: 'state',
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'name',
                                                type: 'string',
                                                example: 'Maharashtra',
                                            ),
                                            new OA\Property(property: 'code', type: 'string', example: 'MH'),
                                            new OA\Property(
                                                property: 'country',
                                                type: 'object',
                                                properties: [
                                                    new OA\Property(property: 'id', type: 'integer', example: 101),
                                                    new OA\Property(
                                                        property: 'name',
                                                        type: 'string',
                                                        example: 'India',
                                                    ),
                                                    new OA\Property(
                                                        property: 'code',
                                                        type: 'string',
                                                        example: 'IN',
                                                    ),
                                                ],
                                            ),
                                        ],
                                    ),
                                    new OA\Property(property: 'created_at', type: 'string', format: 'date-time'),
                                    new OA\Property(property: 'updated_at', type: 'string', format: 'date-time'),
                                ],
                            ),
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
            new OA\Response(response: 401, description: 'Unauthenticated'),
        ],
    )]
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
