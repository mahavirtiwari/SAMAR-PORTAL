<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\Pincode;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class PincodeController extends Controller
{
    #[OA\Get(
        path: '/api/v1/master-data/pincodes',
        summary: 'Search pincodes by pincode number, district or state',
        tags: ['Master Data'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'pincode',
                in: 'query',
                required: false,
                description: 'Search by pincode number',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'state',
                in: 'query',
                required: false,
                description: 'Filter by state name',
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'district',
                in: 'query',
                required: false,
                description: 'Filter by district name',
                schema: new OA\Schema(type: 'string'),
            ),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Pincodes retrieved successfully'),
        ],
    )]
    public function index(Request $request)
    {
        try {
            $query = Pincode::query();

            // Search by pincode
            if ($request->filled('pincode')) {
                $query->where('pincode', 'like', $request->input('pincode').'%');
            }

            // Filter by state
            if ($request->filled('state')) {
                $query->where('state', 'like', '%'.$request->input('state').'%');
            }

            // Filter by district
            if ($request->filled('district')) {
                $query->where('district', 'like', '%'.$request->input('district').'%');
            }

            $pincodes = $query->orderBy('pincode')->limit(100)->get();

            // District master rows by LGD code, in one query rather than one per pincode.
            $districts = District::whereIn('lgd_code', $pincodes->pluck('district_lgd_code')->filter()->unique())
                ->get(['code', 'lgd_code'])
                ->keyBy('lgd_code');

            $pincodesWithCodes = $pincodes->map(fn ($pincode) => [
                'id' => $pincode->id,
                'pincode' => $pincode->pincode,
                'district' => $pincode->district,
                'district_code' => $districts->get($pincode->district_lgd_code)?->code,
                'district_lgd_code' => $pincode->district_lgd_code,
                'state' => $pincode->state,
                'state_lgd_code' => $pincode->state_lgd_code,
            ]);

            return $this->successResponse($pincodesWithCodes, 'Pincodes retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve pincodes');
        }
    }
}
