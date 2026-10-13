<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApplicationAssessmentBasicInformation;
use App\Models\Assessment;
use App\Models\AssessmentTeamMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * @OA\Tag(
 *     name="Application Assessment Basic Information",
 *     description="Step 5: Basic information management. Only Lead Assessor can manage. Structure matches Application model with mfg_/svc_ prefixes for manufacturing/services specific fields."
 * )
 */
class ApplicationAssessmentBasicInformationController extends Controller
{
    /**
     * Get basic information for an assessment.
     *
     * @OA\Get(
     *     path="/api/v1/application-assessments/{assessmentId}/basic-information",
     *     summary="Get basic information",
     *     description="Returns the basic information for the assessment (Step 5). Use mfg_* fields for manufacturing sector and svc_* fields for service sector. Returns null if not yet filled.",
     *     tags={"Application Assessment Basic Information", "Assessor - Assessment"},
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
     *         description="Basic information retrieved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Basic information retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="basic_information",
     *                     type="object",
     *                     nullable=true,
     *                     description="Null if not yet filled",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="assessment_id", type="integer", example=1),
     *                     @OA\Property(property="category", type="string", example="Manufacturing", nullable=true),
     *                     @OA\Property(property="mfg_drdo_vendor_stores", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_products", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_raw_materials", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_bought_out_parts", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_key_processes", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_outsourced_processes", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="mfg_production_capacity", type="number", nullable=true),
     *                     @OA\Property(property="mfg_capacity_unit", type="string", nullable=true),
     *                     @OA\Property(property="svc_provider_type", type="string", nullable=true),
     *                     @OA\Property(property="svc_drdo_vendor_labs", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="svc_services", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="svc_key_resources", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="svc_outsourced_components", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="svc_key_processes", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="svc_outsourced_processes", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="customers", type="array", @OA\Items(type="object"), nullable=true),
     *                     @OA\Property(property="third_party_certifications", type="array", @OA\Items(type="string"), nullable=true),
     *                     @OA\Property(property="filled_by", type="integer", nullable=true),
     *                     @OA\Property(property="created_at", type="string", format="date-time"),
     *                     @OA\Property(property="updated_at", type="string", format="date-time")
     *                 ),
     *                 @OA\Property(property="step_completed", type="boolean", example=false, description="True if all required fields are filled"),
     *                 @OA\Property(
     *                     property="validation",
     *                     type="object",
     *                     @OA\Property(property="is_valid", type="boolean", example=false),
     *                     @OA\Property(
     *                         property="missing",
     *                         type="array",
     *
     *                         @OA\Items(type="string"),
     *                         example={"category", "mfg_drdo_vendor_stores", "mfg_key_processes", "mfg_products", "customers", "mfg_raw_materials", "mfg_bought_out_parts"},
     *                         description="List of required fields that are missing"
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
    public function show(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::with('application')->findOrFail($assessmentId);
        $basicInfo = $assessment->basicInformation;
        $sector = $assessment->application->sector ?? 'manufacturing';

        return $this->successResponse([
            'basic_information' => $basicInfo,
            'step_completed' => $assessment->isBasicInformationComplete(),
            'validation' => $this->getValidationStatus($basicInfo, $sector),
        ], 'Basic information retrieved successfully');
    }

    /**
     * Create or update basic information.
     *
     * @OA\Post(
     *     path="/api/v1/application-assessments/{assessmentId}/basic-information",
     *     summary="Create or update basic information",
     *     description="Create or update the basic information for the assessment. Use mfg_* fields for manufacturing sector and svc_* fields for service sector. Only the lead assessor can perform this action.",
     *     tags={"Application Assessment Basic Information", "Assessor - Assessment"},
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
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="category", type="string", example="Manufacturing", description="Category of the enterprise"),
     *             @OA\Property(
     *                 property="mfg_drdo_vendor_stores",
     *                 type="array",
     *                 description="Manufacturing: DRDO vendor stores list",
     *
     *                 @OA\Items(
     *                     type="object",
     *
     *                     @OA\Property(property="store_name", type="string", example="Store A")
     *                 ),
     *                 example={{"store_name": "DRDO Store 1"}, {"store_name": "DRDO Store 2"}}
     *             ),
     *             @OA\Property(
     *                 property="mfg_products",
     *                 type="array",
     *                 description="Manufacturing: Products/articles manufactured",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"product_name"},
     *
     *                     @OA\Property(property="product_name", type="string", example="Electronic Component A"),
     *                     @OA\Property(property="total_production_capacity", type="number", example=1000),
     *                     @OA\Property(property="capacity_unit", type="string", example="units/month"),
     *                     @OA\Property(property="capacity_unit_utilized", type="string", example="units/month"),
     *                     @OA\Property(property="current_utilized_capacity", type="number", example=750),
     *                     @OA\Property(property="commencement_date", type="string", format="date", example="2020-01-15"),
     *                     @OA\Property(property="is_exported", type="boolean", example=true),
     *                     @OA\Property(property="export_countries", type="array", @OA\Items(type="string"), example={"USA", "Germany"}),
     *                     @OA\Property(property="export_percentage", type="number", example=25.5)
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="mfg_raw_materials",
     *                 type="array",
     *                 description="Manufacturing: Raw materials used",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"material_name"},
     *
     *                     @OA\Property(property="material_name", type="string", example="Steel Grade A"),
     *                     @OA\Property(property="is_imported", type="boolean", example=false),
     *                     @OA\Property(property="import_percentage", type="number", example=0),
     *                     @OA\Property(property="import_country", type="string", example=null)
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="mfg_bought_out_parts",
     *                 type="array",
     *                 description="Manufacturing: Bought out parts",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"part_name"},
     *
     *                     @OA\Property(property="part_name", type="string", example="Capacitor 100uF"),
     *                     @OA\Property(property="is_imported", type="boolean", example=true),
     *                     @OA\Property(property="import_percentage", type="number", example=60),
     *                     @OA\Property(property="import_country", type="string", example="China")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="mfg_key_processes",
     *                 type="array",
     *                 description="Manufacturing: Key processes",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"process_name"},
     *
     *                     @OA\Property(property="process_name", type="string", example="CNC Machining")
     *                 ),
     *                 example={{"process_name": "CNC Machining"}, {"process_name": "Heat Treatment"}}
     *             ),
     *             @OA\Property(
     *                 property="mfg_outsourced_processes",
     *                 type="array",
     *                 description="Manufacturing: Outsourced processes",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"process_name"},
     *
     *                     @OA\Property(property="process_name", type="string", example="Electroplating")
     *                 )
     *             ),
     *             @OA\Property(property="mfg_production_capacity", type="number", example=5000, description="Manufacturing: Overall production capacity"),
     *             @OA\Property(property="mfg_capacity_unit", type="string", example="units/month", description="Manufacturing: Capacity unit"),
     *             @OA\Property(property="svc_provider_type", type="string", example="Testing Laboratory", description="Services: Type of service provider"),
     *             @OA\Property(
     *                 property="svc_drdo_vendor_labs",
     *                 type="array",
     *                 description="Services: DRDO vendor labs",
     *
     *                 @OA\Items(
     *                     type="object",
     *
     *                     @OA\Property(property="lab_name", type="string", example="Testing Lab A")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="svc_services",
     *                 type="array",
     *                 description="Services: Services offered",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"service_name"},
     *
     *                     @OA\Property(property="service_name", type="string", example="Material Testing"),
     *                     @OA\Property(property="total_services_capacity", type="number", example=500),
     *                     @OA\Property(property="capacity_unit", type="string", example="tests/month"),
     *                     @OA\Property(property="current_utilized_capacity", type="number", example=350),
     *                     @OA\Property(property="commencement_date", type="string", format="date", example="2019-06-01"),
     *                     @OA\Property(property="is_exported", type="boolean", example=false),
     *                     @OA\Property(property="export_countries", type="array", @OA\Items(type="string")),
     *                     @OA\Property(property="export_percentage", type="number", example=0)
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="svc_key_resources",
     *                 type="array",
     *                 description="Services: Key resources",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"resource_name"},
     *
     *                     @OA\Property(property="resource_name", type="string", example="Spectrometer")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="svc_outsourced_components",
     *                 type="array",
     *                 description="Services: Outsourced components",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"component_name"},
     *
     *                     @OA\Property(property="component_name", type="string", example="Calibration Services")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="svc_key_processes",
     *                 type="array",
     *                 description="Services: Key processes",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"process_name"},
     *
     *                     @OA\Property(property="process_name", type="string", example="Quality Testing")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="svc_outsourced_processes",
     *                 type="array",
     *                 description="Services: Outsourced processes",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"process_name"},
     *
     *                     @OA\Property(property="process_name", type="string", example="Third Party Audit")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="customers",
     *                 type="array",
     *                 description="Common: Customer list (required)",
     *
     *                 @OA\Items(
     *                     type="object",
     *                     required={"customer_name", "customer_type"},
     *
     *                     @OA\Property(property="customer_name", type="string", example="DRDO Lab X"),
     *                     @OA\Property(property="customer_type", type="string", enum={"domestic", "international"}, example="domestic"),
     *                     @OA\Property(property="country", type="string", example="India", description="Required if customer_type is international")
     *                 )
     *             ),
     *             @OA\Property(
     *                 property="third_party_certifications",
     *                 type="array",
     *                 description="Common: Third party certifications held",
     *
     *                 @OA\Items(type="string"),
     *                 example={"ISO 9001:2015", "AS9100D", "NABL Accreditation"}
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Basic information saved successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Basic information saved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="basic_information", type="object"),
     *                 @OA\Property(property="step_completed", type="boolean", example=true),
     *                 @OA\Property(
     *                     property="validation",
     *                     type="object",
     *                     @OA\Property(property="is_valid", type="boolean", example=true),
     *                     @OA\Property(property="missing", type="array", @OA\Items(type="string"), example={})
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=400, description="Assessment not in progress"),
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Only the lead assessor can manage basic information"),
     *     @OA\Response(response=422, description="Validation error")
     * )
     */
    public function store(Request $request, int $assessmentId): JsonResponse
    {
        $assessment = Assessment::with('application')->findOrFail($assessmentId);
        $user = $request->user();

        // Only lead assessor can create/update basic information
        $teamMember = $assessment->teamMembers()
            ->where('user_id', $user->id)
            ->where('role', AssessmentTeamMember::ROLE_LEAD_ASSESSOR)
            ->first();

        if (! $teamMember) {
            return $this->errorResponse('Only the lead assessor can manage basic information', 403);
        }

        if (! in_array($assessment->status, [Assessment::STATUS_IN_PROGRESS, Assessment::STATUS_MOBILE_COMPLETE], true)) {
            return $this->errorResponse('Basic information can only be managed while the assessment is in progress or field work is complete', 400);
        }

        $validator = Validator::make($request->all(), $this->getValidationRules());

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed', 422, $validator->errors()->toArray());
        }

        DB::beginTransaction();
        try {
            $basicInfo = $assessment->basicInformation;
            $isNew = ! $basicInfo;

            $data = $request->only([
                'category',
                // Manufacturing fields
                'mfg_drdo_vendor_stores',
                'mfg_products',
                'mfg_raw_materials',
                'mfg_bought_out_parts',
                'mfg_key_processes',
                'mfg_outsourced_processes',
                'mfg_production_capacity',
                'mfg_capacity_unit',
                // Services fields
                'svc_provider_type',
                'svc_drdo_vendor_labs',
                'svc_services',
                'svc_key_resources',
                'svc_outsourced_components',
                'svc_key_processes',
                'svc_outsourced_processes',
                // Common fields
                'third_party_certifications',
                'customers',
            ]);

            if ($isNew) {
                $data['assessment_id'] = $assessmentId;
                $data['filled_by'] = $user->id;
                $basicInfo = ApplicationAssessmentBasicInformation::create($data);
            } else {
                $basicInfo->update($data);
            }

            // Refresh the relationship cache so isBasicInformationComplete() uses the new data
            $assessment->load('basicInformation');

            // Update step progress
            $assessment->recalculateStepProgress();

            DB::commit();

            $sector = $assessment->application->sector ?? 'manufacturing';

            return $this->successResponse([
                'basic_information' => $basicInfo->fresh(),
                'step_completed' => $assessment->isBasicInformationComplete(),
                'validation' => $this->getValidationStatus($basicInfo->fresh(), $sector),
            ], 'Basic information saved successfully');
        } catch (\Exception $e) {
            DB::rollBack();

            return $this->serverErrorResponse($e, 'Failed to save basic information');
        }
    }

    /**
     * Get validation rules for basic information.
     */
    private function getValidationRules(): array
    {
        return [
            'category' => 'nullable|string|max:255',
            // Manufacturing fields
            'mfg_drdo_vendor_stores' => 'nullable|array',
            'mfg_drdo_vendor_stores.*.store_name' => 'nullable|string|max:255',
            'mfg_products' => 'nullable|array',
            'mfg_products.*.product_name' => 'required|string|max:255',
            'mfg_products.*.total_production_capacity' => 'nullable|numeric|min:0',
            'mfg_products.*.capacity_unit' => 'nullable|string|max:50',
            'mfg_products.*.capacity_unit_utilized' => 'nullable|string|max:50',
            'mfg_products.*.current_utilized_capacity' => 'nullable|numeric|min:0',
            'mfg_products.*.commencement_date' => 'nullable|date',
            'mfg_products.*.is_exported' => 'nullable|boolean',
            'mfg_products.*.export_countries' => 'nullable|array',
            'mfg_products.*.export_percentage' => 'nullable|numeric|min:0|max:100',
            'mfg_raw_materials' => 'nullable|array',
            'mfg_raw_materials.*.material_name' => 'required|string|max:100',
            'mfg_raw_materials.*.is_imported' => 'nullable|boolean',
            'mfg_raw_materials.*.import_percentage' => 'nullable|numeric|min:0|max:100',
            'mfg_raw_materials.*.import_country' => 'nullable|string|max:100',
            'mfg_bought_out_parts' => 'nullable|array',
            'mfg_bought_out_parts.*.part_name' => 'required|string|max:100',
            'mfg_bought_out_parts.*.is_imported' => 'nullable|boolean',
            'mfg_bought_out_parts.*.import_percentage' => 'nullable|numeric|min:0|max:100',
            'mfg_bought_out_parts.*.import_country' => 'nullable|string|max:100',
            'mfg_key_processes' => 'nullable|array',
            'mfg_key_processes.*.process_name' => 'required|string|max:100',
            'mfg_outsourced_processes' => 'nullable|array',
            'mfg_outsourced_processes.*.process_name' => 'required|string|max:100',
            'mfg_production_capacity' => 'nullable|numeric|min:0',
            'mfg_capacity_unit' => 'nullable|string|max:50',
            // Services fields
            'svc_provider_type' => 'nullable|string|max:255',
            'svc_drdo_vendor_labs' => 'nullable|array',
            'svc_drdo_vendor_labs.*.lab_name' => 'nullable|string|max:255',
            'svc_services' => 'nullable|array',
            'svc_services.*.service_name' => 'required|string|max:255',
            'svc_services.*.total_services_capacity' => 'nullable|numeric|min:0',
            'svc_services.*.capacity_unit' => 'nullable|string|max:50',
            'svc_services.*.current_utilized_capacity' => 'nullable|numeric|min:0',
            'svc_services.*.commencement_date' => 'nullable|date',
            'svc_services.*.is_exported' => 'nullable|boolean',
            'svc_services.*.export_countries' => 'nullable|array',
            'svc_services.*.export_percentage' => 'nullable|numeric|min:0|max:100',
            'svc_key_resources' => 'nullable|array',
            'svc_key_resources.*.resource_name' => 'required|string|max:255',
            'svc_outsourced_components' => 'nullable|array',
            'svc_outsourced_components.*.component_name' => 'required|string|max:255',
            'svc_key_processes' => 'nullable|array',
            'svc_key_processes.*.process_name' => 'required|string|max:100',
            'svc_outsourced_processes' => 'nullable|array',
            'svc_outsourced_processes.*.process_name' => 'required|string|max:100',
            // Common fields
            'third_party_certifications' => 'nullable|array',
            'third_party_certifications.*' => 'string|max:255',
            'customers' => 'nullable|array',
            'customers.*.customer_name' => 'required|string|max:255',
            'customers.*.customer_type' => 'required|in:domestic,international',
            'customers.*.country' => 'nullable|string|max:100',
        ];
    }

    /**
     * Get validation status for basic information.
     */
    private function getValidationStatus(?ApplicationAssessmentBasicInformation $basicInfo, string $sector): array
    {
        if (! $basicInfo) {
            if ($sector === 'service') {
                return [
                    'is_valid' => false,
                    'missing' => ['category', 'svc_drdo_vendor_labs', 'svc_key_processes', 'svc_services', 'customers'],
                ];
            }

            return [
                'is_valid' => false,
                'missing' => ['category', 'mfg_drdo_vendor_stores', 'mfg_key_processes', 'mfg_products', 'customers', 'mfg_raw_materials_or_bought_out_parts'],
            ];
        }

        $missing = [];

        if (empty($basicInfo->category)) {
            $missing[] = 'category';
        }

        if ($sector === 'service') {
            if (empty($basicInfo->svc_drdo_vendor_labs)) {
                $missing[] = 'svc_drdo_vendor_labs';
            }
            if (empty($basicInfo->svc_key_processes)) {
                $missing[] = 'svc_key_processes';
            }
            if (empty($basicInfo->svc_services)) {
                $missing[] = 'svc_services';
            }
        } else {
            // Manufacturing
            if (empty($basicInfo->mfg_drdo_vendor_stores)) {
                $missing[] = 'mfg_drdo_vendor_stores';
            }
            if (empty($basicInfo->mfg_key_processes)) {
                $missing[] = 'mfg_key_processes';
            }
            if (empty($basicInfo->mfg_products)) {
                $missing[] = 'mfg_products';
            }
            // At least one of raw_materials or bought_out_parts must be present
            if (empty($basicInfo->mfg_raw_materials) && empty($basicInfo->mfg_bought_out_parts)) {
                $missing[] = 'mfg_raw_materials_or_bought_out_parts';
            }
        }

        if (empty($basicInfo->customers)) {
            $missing[] = 'customers';
        }

        return [
            'is_valid' => empty($missing),
            'missing' => $missing,
        ];
    }
}
