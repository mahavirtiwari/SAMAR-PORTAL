<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\District;
use App\Models\Pincode;
use Illuminate\Http\Request;

class PincodeController extends Controller
{
    /**
     * @OA\Get(
     *     path="/api/v1/master-data/pincodes",
     *     summary="Search pincodes by pincode number, district or state",
     *     tags={"Master Data"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="pincode",
     *         in="query",
     *         required=false,
     *         description="Search by pincode number",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="state",
     *         in="query",
     *         required=false,
     *         description="Filter by state name",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Parameter(
     *         name="district",
     *         in="query",
     *         required=false,
     *         description="Filter by district name",
     *
     *         @OA\Schema(type="string")
     *     ),
     *
     *     @OA\Response(response=200, description="Pincodes retrieved successfully")
     * )
     */
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

            // Look up district codes and add to response
            $pincodesWithCodes = $pincodes->map(function ($pincode) {
                $district = District::whereRaw('LOWER(name) = ?', [strtolower($pincode->getRawOriginal('district'))])->first();

                return [
                    'id' => $pincode->id,
                    'pincode' => $pincode->pincode,
                    'district' => $pincode->district,
                    'district_code' => $district?->code ?? null,
                    'state' => $pincode->state,
                ];
            });

            return $this->successResponse($pincodesWithCodes, 'Pincodes retrieved successfully');
        } catch (\Exception $e) {
            return $this->serverErrorResponse($e, 'Failed to retrieve pincodes');
        }
    }
}
