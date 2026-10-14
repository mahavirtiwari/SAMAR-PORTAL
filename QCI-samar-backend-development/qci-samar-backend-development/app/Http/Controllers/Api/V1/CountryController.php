<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Country;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class CountryController extends Controller
{
    #[OA\Get(
        path: '/api/v1/master-data/countries',
        summary: 'List all countries',
        tags: ['Master Data'],
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
            new OA\Response(response: 200, description: 'Countries retrieved successfully'),
            new OA\Response(response: 400, description: 'Bad request - conflicting parameters'),
        ],
    )]
    public function index(Request $request)
    {
        try {
            $query = Country::orderBy('name');

            return $this->listResponse(
                $request,
                $query,
                null,
                'Countries retrieved successfully',
                15,
                500 // Countries dataset is small, allow up to 500
            );
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve countries.');
        }
    }
}
