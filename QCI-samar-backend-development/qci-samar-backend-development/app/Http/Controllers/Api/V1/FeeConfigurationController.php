<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FeeConfiguration\StoreFeeConfigurationRequest;
use App\Http\Requests\FeeConfiguration\UpdateFeeConfigurationRequest;
use App\Http\Resources\FeeConfigurationResource;
use App\Models\FeeConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Fee Configurations",
 *     description="API Endpoints for managing fee configurations by sector and enterprise size"
 * )
 */
class FeeConfigurationController extends Controller
{
    /**
     * Display a listing of fee configurations.
     *
     * @OA\Get(
     *     path="/api/v1/fee-configurations",
     *     operationId="getFeeConfigurations",
     *     tags={"Fee Configurations"},
     *     summary="Get list of fee configurations",
     *     description="Returns paginated list of fee configurations with optional filters",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Filter by sector (manufacturing or service)",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="enterpriseSize",
     *         in="query",
     *         description="Filter by enterprise size",
     *         required=false,
     *
     *         @OA\Schema(type="string", enum={"startup", "micro", "small", "medium", "large"})
     *     ),
     *
     *     @OA\Parameter(
     *         name="perPage",
     *         in="query",
     *         description="Items per page (max 100)",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=15, maximum=100)
     *     ),
     *
     *     @OA\Parameter(
     *         name="page",
     *         in="query",
     *         description="Page number",
     *         required=false,
     *
     *         @OA\Schema(type="integer", default=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configurations retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="data",
     *                     type="array",
     *
     *                     @OA\Items(
     *
     *                         @OA\Property(property="id", type="integer", example=1),
     *                         @OA\Property(property="sector", type="string", example="manufacturing"),
     *                         @OA\Property(property="enterprise_size", type="string", example="micro"),
     *                         @OA\Property(property="base_certification_fee", type="number", format="float", example=15000.00),
     *                         @OA\Property(property="food_and_accommodation_fee", type="number", format="float", example=5000.00),
     *                         @OA\Property(property="gst_percentage", type="number", format="float", example=18.00),
     *                         @OA\Property(property="total_fee", type="number", format="float", example=20000.00),
     *                         @OA\Property(property="gst_amount", type="number", format="float", example=3600.00),
     *                         @OA\Property(property="created_at", type="string", format="date-time"),
     *                         @OA\Property(property="updated_at", type="string", format="date-time")
     *                     )
     *                 ),
     *                 @OA\Property(property="current_page", type="integer", example=1),
     *                 @OA\Property(property="per_page", type="integer", example=15),
     *                 @OA\Property(property="total", type="integer", example=50),
     *                 @OA\Property(property="last_page", type="integer", example=4)
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $query = FeeConfiguration::query();

        // Filter by sector
        if ($request->filled('sector')) {
            $query->where('sector', $request->sector);
        }

        // Filter by enterprise size
        if ($request->filled('enterprise_size')) {
            $query->where('enterprise_size', $request->enterprise_size);
        }

        // Order by sector and enterprise size
        $query->orderBy('sector')->orderBy('enterprise_size');

        // Use listResponse to support ?all=true for returning all records without pagination
        return $this->listResponse(
            $request,
            $query,
            FeeConfigurationResource::class,
            'Fee configurations retrieved successfully'
        );
    }

    /**
     * Store a newly created fee configuration.
     *
     * @OA\Post(
     *     path="/api/v1/fee-configurations",
     *     operationId="storeFeeConfiguration",
     *     tags={"Fee Configurations"},
     *     summary="Create a new fee configuration",
     *     description="Create a new fee configuration for a specific sector and enterprise size",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"sector", "enterpriseSize", "baseCertificationFee", "foodAndAccommodationFee", "gstPercentage"},
     *
     *             @OA\Property(property="sector", type="string", enum={"manufacturing", "service"}, example="manufacturing"),
     *             @OA\Property(property="enterpriseSize", type="string", enum={"startup", "micro", "small", "medium", "large"}, example="micro"),
     *             @OA\Property(property="baseCertificationFee", type="number", format="float", example=15000.00, description="Base certification fee amount"),
     *             @OA\Property(property="foodAndAccommodationFee", type="number", format="float", example=5000.00, description="Food and accommodation fee amount"),
     *             @OA\Property(property="gstPercentage", type="number", format="float", example=18.00, description="GST percentage"),
     *             @OA\Property(property="tdsEnabled", type="boolean", example=false, description="TDS enabled toggle")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Fee configuration created successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration created successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="sector", type="string", example="manufacturing"),
     *                 @OA\Property(property="enterprise_size", type="string", example="micro"),
     *                 @OA\Property(property="base_certification_fee", type="number", format="float", example=15000.00),
     *                 @OA\Property(property="food_and_accommodation_fee", type="number", format="float", example=5000.00),
     *                 @OA\Property(property="tds_percentage", type="string", example="2"),
     *                 @OA\Property(property="gst_percentage", type="number", format="float", example=18.00),
     *                 @OA\Property(property="tds_enabled", type="boolean", example=false),
     *                 @OA\Property(property="total_fee", type="number", format="float", example=20000.00),
     *                 @OA\Property(property="gst_amount", type="number", format="float", example=3600.00),
     *                 @OA\Property(property="tds_amount", type="number", format="float", example=400.00),
     *                 @OA\Property(property="net_payable", type="number", format="float", example=23200.00),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=400,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="sector", type="array", @OA\Items(type="string", example="The sector field is required."))
     *             )
     *         )
     *     )
     * )
     */
    public function store(StoreFeeConfigurationRequest $request): JsonResponse
    {
        $feeConfiguration = FeeConfiguration::create($request->validated());

        return $this->successResponse(
            new FeeConfigurationResource($feeConfiguration),
            'Fee configuration created successfully',
            201
        );
    }

    /**
     * Display the specified fee configuration.
     *
     * @OA\Get(
     *     path="/api/v1/fee-configurations/{id}",
     *     operationId="getFeeConfiguration",
     *     tags={"Fee Configurations"},
     *     summary="Get fee configuration by ID",
     *     description="Returns a single fee configuration",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Fee configuration ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="sector", type="string", example="manufacturing"),
     *                 @OA\Property(property="enterprise_size", type="string", example="micro"),
     *                 @OA\Property(property="base_certification_fee", type="number", format="float", example=15000.00),
     *                 @OA\Property(property="food_and_accommodation_fee", type="number", format="float", example=5000.00),
     *                 @OA\Property(property="tds_percentage", type="string", example="2"),
     *                 @OA\Property(property="gst_percentage", type="number", format="float", example=18.00),
     *                 @OA\Property(property="tds_enabled", type="boolean", example=false),
     *                 @OA\Property(property="total_fee", type="number", format="float", example=20000.00),
     *                 @OA\Property(property="gst_amount", type="number", format="float", example=3600.00),
     *                 @OA\Property(property="tds_amount", type="number", format="float", example=400.00),
     *                 @OA\Property(property="net_payable", type="number", format="float", example=23200.00),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Fee configuration not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Fee configuration not found")
     *         )
     *     )
     * )
     */
    public function show(int $id): JsonResponse
    {
        $feeConfiguration = FeeConfiguration::find($id);

        if (! $feeConfiguration) {
            return $this->errorResponse('Fee configuration not found', 404);
        }

        return $this->successResponse(
            new FeeConfigurationResource($feeConfiguration),
            'Fee configuration retrieved successfully'
        );
    }

    /**
     * Update the specified fee configuration.
     *
     * @OA\Put(
     *     path="/api/v1/fee-configurations/{id}",
     *     operationId="updateFeeConfiguration",
     *     tags={"Fee Configurations"},
     *     summary="Update fee configuration",
     *     description="Update an existing fee configuration",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Fee configuration ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="sector", type="string", enum={"manufacturing", "service"}, example="manufacturing"),
     *             @OA\Property(property="enterpriseSize", type="string", enum={"startup", "micro", "small", "medium", "large"}, example="micro"),
     *             @OA\Property(property="baseCertificationFee", type="number", format="float", example=15000.00),
     *             @OA\Property(property="foodAndAccommodationFee", type="number", format="float", example=5000.00),
     *             @OA\Property(property="gstPercentage", type="number", format="float", example=18.00),
     *             @OA\Property(property="tdsEnabled", type="boolean", example=false, description="TDS enabled toggle")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Fee configuration updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="sector", type="string", example="manufacturing"),
     *                 @OA\Property(property="enterprise_size", type="string", example="micro"),
     *                 @OA\Property(property="base_certification_fee", type="number", format="float", example=15000.00),
     *                 @OA\Property(property="food_and_accommodation_fee", type="number", format="float", example=5000.00),
     *                 @OA\Property(property="tds_percentage", type="string", example="2"),
     *                 @OA\Property(property="gst_percentage", type="number", format="float", example=18.00),
     *                 @OA\Property(property="tds_enabled", type="boolean", example=false),
     *                 @OA\Property(property="total_fee", type="number", format="float", example=20000.00),
     *                 @OA\Property(property="gst_amount", type="number", format="float", example=3600.00),
     *                 @OA\Property(property="tds_amount", type="number", format="float", example=400.00),
     *                 @OA\Property(property="net_payable", type="number", format="float", example=23200.00),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Fee configuration not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Fee configuration not found")
     *         )
     *     ),
     * )
     */
    public function update(UpdateFeeConfigurationRequest $request, int $id): JsonResponse
    {
        $feeConfiguration = FeeConfiguration::find($id);

        if (! $feeConfiguration) {
            return $this->errorResponse('Fee configuration not found', 404);
        }

        $feeConfiguration->update($request->validated());

        return $this->successResponse(
            new FeeConfigurationResource($feeConfiguration->fresh()),
            'Fee configuration updated successfully'
        );
    }

    /**
     * Remove the specified fee configuration.
     *
     * @OA\Delete(
     *     path="/api/v1/fee-configurations/{id}",
     *     operationId="deleteFeeConfiguration",
     *     tags={"Fee Configurations"},
     *     summary="Delete fee configuration",
     *     description="Soft delete a fee configuration",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Fee configuration ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Fee configuration deleted successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration deleted successfully"),
     *             @OA\Property(property="data", type="object", nullable=true, example=null)
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Fee configuration not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Fee configuration not found")
     *         )
     *     )
     * )
     */

    /**
     * Find fee configuration by sector and enterprise size.
     *
     * @OA\Get(
     *     path="/api/v1/fee-configurations/lookup",
     *     operationId="lookupFeeConfiguration",
     *     tags={"Fee Configurations"},
     *     summary="Lookup fee configuration",
     *     description="Get fee configuration by sector and enterprise size combination",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Parameter(
     *         name="sector",
     *         in="query",
     *         description="Sector type",
     *         required=true,
     *
     *         @OA\Schema(type="string", enum={"manufacturing", "service"}, example="manufacturing")
     *     ),
     *
     *     @OA\Parameter(
     *         name="enterpriseSize",
     *         in="query",
     *         description="Enterprise size",
     *         required=true,
     *
     *         @OA\Schema(type="string", enum={"startup", "micro", "small", "medium", "large"}, example="micro")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Fee configuration found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="sector", type="string", example="manufacturing"),
     *                 @OA\Property(property="enterprise_size", type="string", example="micro"),
     *                 @OA\Property(property="base_certification_fee", type="number", format="float", example=15000.00),
     *                 @OA\Property(property="food_and_accommodation_fee", type="number", format="float", example=5000.00),
     *                 @OA\Property(property="tds_percentage", type="string", example="2"),
     *                 @OA\Property(property="gst_percentage", type="number", format="float", example=18.00),
     *                 @OA\Property(property="tds_enabled", type="boolean", example=false),
     *                 @OA\Property(property="total_fee", type="number", format="float", example=20000.00),
     *                 @OA\Property(property="gst_amount", type="number", format="float", example=3600.00),
     *                 @OA\Property(property="tds_amount", type="number", format="float", example=400.00),
     *                 @OA\Property(property="net_payable", type="number", format="float", example=23200.00),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Fee configuration not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Fee configuration not found for the specified sector and enterprise size")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="sector", type="array", @OA\Items(type="string"))
     *             )
     *         )
     *     )
     * )
     */

    /**
     * Get all available options for dropdowns.
     *
     * @OA\Get(
     *     path="/api/v1/fee-configurations/options",
     *     operationId="getFeeConfigurationOptions",
     *     tags={"Fee Configurations"},
     *     summary="Get fee configuration options",
     *     description="Get all available options for sectors, enterprise sizes, and TDS percentages",
     *     security={{"bearerAuth": {}}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Options retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Fee configuration options retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="sectors",
     *                     type="array",
     *
     *                     @OA\Items(type="string"),
     *                     example={"manufacturing", "service"}
     *                 ),
     *
     *                 @OA\Property(
     *                     property="enterprise_sizes",
     *                     type="array",
     *
     *                     @OA\Items(type="string"),
     *                     example={"startup", "micro", "small", "medium", "large"}
     *                 ),
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
}
