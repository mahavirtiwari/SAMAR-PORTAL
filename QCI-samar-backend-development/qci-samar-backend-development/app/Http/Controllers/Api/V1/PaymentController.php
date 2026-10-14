<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Payment\PaymentExportRequest;
use App\Models\Application;
use App\Models\Payment;
use App\Models\Role;
use App\Models\User;
use App\Services\Payment\FeeCalculator;
use App\Services\Payment\PaymentGatewayFactory;
use App\Services\StateFilterService;
use App\Support\Csv;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;
use Symfony\Component\HttpFoundation\StreamedResponse;

#[OA\Tag(name: 'Payments', description: 'Payment management endpoints')]
class PaymentController extends Controller
{
    public function __construct(
        private StateFilterService $stateFilterService
    ) {}

    /**
     * Get all payments for the authenticated user.
     */
    #[OA\Get(
        path: '/api/v1/payments',
        summary: 'Get all payments',
        description: 'Retrieves a paginated list of payments for the authenticated user. System administrators can view all payments, while other users see only payments related to their organization.',
        tags: [
            'Payment',
            'System Admin - Payment',
            'DRDO Admin - Payment',
            'Operations Manager - Payment',
            'Operations Admin - Payment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                description: 'Search by order ID, transaction ID, or application number',
                required: false,
                schema: new OA\Schema(type: 'string', minLength: 2, maxLength: 100, example: 'SAMAR-19'),
            ),
            new OA\Parameter(
                name: 'applicationId',
                in: 'query',
                description: 'Filter payments by application ID',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
            new OA\Parameter(
                name: 'paymentType',
                in: 'query',
                description: 'Filter payments by type',
                required: false,
                schema: new OA\Schema(
                    type: 'string',
                    enum: ['application_fee', 'assessment_fee', 'certification_fee', 'surveillance_fee', 'other'],
                    example: 'application_fee',
                ),
            ),
            new OA\Parameter(
                name: 'fromDate',
                in: 'query',
                description: 'Include payments created on or after this date. Applies to both the list and the totals.',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2026-08-01'),
            ),
            new OA\Parameter(
                name: 'toDate',
                in: 'query',
                description: 'Include payments created on or before this date. Applies to both the list and the totals.',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date', example: '2026-08-31'),
            ),
            new OA\Parameter(
                name: 'perPage',
                in: 'query',
                description: 'Number of items per page',
                required: false,
                schema: new OA\Schema(type: 'integer', example: 15, default: 15),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Payments retrieved successfully. Carries a summary object with successfulCount and failedCount for the whole filtered set, not just the current page.',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'payments',
                                    type: 'array',
                                    items: new OA\Items(
                                        type: 'object',
                                        properties: [
                                            new OA\Property(property: 'id', type: 'integer', example: 1),
                                            new OA\Property(
                                                property: 'payment_number',
                                                type: 'string',
                                                example: 'PAY-2025-000001',
                                            ),
                                            new OA\Property(
                                                property: 'application_id',
                                                type: 'integer',
                                                example: 1,
                                            ),
                                            new OA\Property(
                                                property: 'payment_type',
                                                type: 'string',
                                                example: 'application_fee',
                                            ),
                                            new OA\Property(
                                                property: 'amount',
                                                type: 'number',
                                                format: 'float',
                                                example: 5000.00,
                                            ),
                                            new OA\Property(property: 'currency', type: 'string', example: 'INR'),
                                            new OA\Property(
                                                property: 'status',
                                                type: 'string',
                                                example: 'success',
                                            ),
                                            new OA\Property(
                                                property: 'gateway',
                                                type: 'string',
                                                example: 'icici_eazypay',
                                            ),
                                            new OA\Property(
                                                property: 'gateway_payment_id',
                                                type: 'string',
                                                example: 'pay_ABC123XYZ',
                                            ),
                                            new OA\Property(
                                                property: 'paid_at',
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2025-01-15T10:30:00+05:30',
                                            ),
                                            new OA\Property(
                                                property: 'created_at',
                                                type: 'string',
                                                format: 'date-time',
                                                example: '2025-01-15T10:25:00+05:30',
                                            ),
                                        ],
                                    ),
                                ),
                                new OA\Property(
                                    property: 'pagination',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'total', type: 'integer', example: 50),
                                        new OA\Property(property: 'per_page', type: 'integer', example: 15),
                                        new OA\Property(property: 'current_page', type: 'integer', example: 1),
                                        new OA\Property(property: 'last_page', type: 'integer', example: 4),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Assessors and DRDO Lab users do not have access to payment data
        if ($user->hasAnyRole([Role::ASSESSOR, Role::DRDO_LAB])) {
            return $this->errorResponse('You are not authorized to view payments.', 403);
        }

        // Refuse an unusable date rather than filtering on it: an unparseable value would
        // otherwise return an empty list and a zero total, which reads as "no payments"
        // instead of "your filter is wrong".
        $validator = Validator::make($request->all(), [
            'from_date' => ['nullable', 'date'],
            'to_date' => ['nullable', 'date', 'after_or_equal:from_date'],
        ], [
            'to_date.after_or_equal' => 'The To Date cannot be earlier than the From Date.',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors()->toArray());
        }

        $query = $this->buildListQuery($request, $user);

        // Counted before paginating and from a copy of the same query, so the totals
        // describe the whole filtered set rather than the page, and cannot drift from the
        // rows the caller is looking at. toBase drops the eager loads, which an aggregate
        // does not need.
        $countsByStatus = (clone $query)->toBase()
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $perPage = $this->resolvePerPage($request, 15);
        $payments = $query->latest()->paginate($perPage);

        $payments->getCollection()->transform(fn ($payment) => $this->formatPayment($payment));

        return $this->paginatedResponse($payments, 'Payments retrieved successfully', null, [
            'summary' => [
                'successful_count' => (int) ($countsByStatus['success'] ?? 0),
                'failed_count' => (int) ($countsByStatus['failed'] ?? 0),
            ],
        ]);
    }

    /**
     * Get a single payment.
     */
    #[OA\Get(
        path: '/api/v1/payments/{id}',
        summary: 'Get payment details',
        description: 'Retrieves detailed information about a specific payment. Users can only view payments related to their organization unless they have system-wide admin roles.',
        tags: [
            'Payment',
            'System Admin - Payment',
            'DRDO Admin - Payment',
            'Operations Manager - Payment',
            'Operations Admin - Payment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'id',
                in: 'path',
                description: 'Payment ID',
                required: true,
                schema: new OA\Schema(type: 'integer', example: 1),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Payment details retrieved successfully',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(
                                    property: 'payment',
                                    type: 'object',
                                    properties: [
                                        new OA\Property(property: 'id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'payment_number',
                                            type: 'string',
                                            example: 'PAY-2025-000001',
                                        ),
                                        new OA\Property(property: 'application_id', type: 'integer', example: 1),
                                        new OA\Property(
                                            property: 'payment_type',
                                            type: 'string',
                                            example: 'application_fee',
                                        ),
                                        new OA\Property(
                                            property: 'amount',
                                            type: 'number',
                                            format: 'float',
                                            example: 5000.00,
                                        ),
                                        new OA\Property(property: 'currency', type: 'string', example: 'INR'),
                                        new OA\Property(property: 'status', type: 'string', example: 'success'),
                                        new OA\Property(
                                            property: 'gateway',
                                            type: 'string',
                                            example: 'icici_eazypay',
                                        ),
                                        new OA\Property(
                                            property: 'gateway_payment_id',
                                            type: 'string',
                                            example: 'pay_ABC123XYZ',
                                        ),
                                        new OA\Property(
                                            property: 'paid_at',
                                            type: 'string',
                                            format: 'date-time',
                                            example: '2025-01-15T10:30:00+05:30',
                                        ),
                                        new OA\Property(
                                            property: 'created_at',
                                            type: 'string',
                                            format: 'date-time',
                                            example: '2025-01-15T10:25:00+05:30',
                                        ),
                                        new OA\Property(
                                            property: 'application',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'application_number',
                                                    type: 'string',
                                                    example: 'APP-2025-000001',
                                                ),
                                                new OA\Property(
                                                    property: 'organization',
                                                    type: 'object',
                                                    properties: [
                                                        new OA\Property(
                                                            property: 'id',
                                                            type: 'integer',
                                                            example: 1,
                                                        ),
                                                        new OA\Property(
                                                            property: 'name',
                                                            type: 'string',
                                                            example: 'ABC Industries Ltd',
                                                        ),
                                                    ],
                                                ),
                                            ],
                                        ),
                                        new OA\Property(
                                            property: 'paid_by',
                                            type: 'object',
                                            properties: [
                                                new OA\Property(property: 'id', type: 'integer', example: 1),
                                                new OA\Property(
                                                    property: 'name',
                                                    type: 'string',
                                                    example: 'John Doe',
                                                ),
                                                new OA\Property(
                                                    property: 'email',
                                                    type: 'string',
                                                    example: 'john.doe@example.com',
                                                ),
                                            ],
                                        ),
                                        new OA\Property(
                                            property: 'description',
                                            type: 'string',
                                            example: 'Payment for initial application fee',
                                        ),
                                        new OA\Property(
                                            property: 'failure_reason',
                                            type: 'string',
                                            nullable: true,
                                            example: null,
                                        ),
                                    ],
                                ),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 401,
                description: 'Unauthenticated',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Unauthenticated.'),
                    ],
                ),
            ),
            new OA\Response(
                response: 403,
                description: 'Unauthorized to view this payment',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: false),
                        new OA\Property(
                            property: 'message',
                            type: 'string',
                            example: 'Unauthorized to view this payment.',
                        ),
                    ],
                ),
            ),
            new OA\Response(
                response: 404,
                description: 'Payment not found',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string', example: 'Payment not found.'),
                    ],
                ),
            ),
        ],
    )]
    public function show(Request $request, int $id): JsonResponse
    {
        $payment = Payment::with(['application.organization', 'paidBy'])->find($id);

        if (! $payment) {
            return $this->errorResponse('Payment not found.', 404);
        }

        $user = $request->user();

        // Check authorization
        if (! $user->hasAnyRole(['system_admin', 'drdo_admin', 'operations_manager', 'operations_admin'])) {
            if ($payment->application->organization_id !== $user->organization_id) {
                return $this->errorResponse('Unauthorized to view this payment.', 403);
            }

            if ($user->hasRole(Role::UNIT_ADMIN)
                && ! in_array($payment->application->unit_id, $user->assignedUnitIds(), true)) {
                return $this->errorResponse('Unauthorized to view this payment.', 403);
            }
        }

        return $this->successResponse([
            'payment' => $this->formatPayment($payment, true),
        ], 'Payment retrieved successfully');
    }

    /**
     * Initiate a new payment.
     *
     * @OA\Post(
     *     path="/api/v1/payments/initiate",
     *     summary="Initiate a new payment",
     *     description="Creates a new payment record and initiates the payment process with the selected payment gateway. Returns gateway-specific data required for completing the payment. For ICICI EazyPay, organization details are automatically fetched from the application.",
     *     tags={"Payment", "System Admin - Payment", "DRDO Admin - Payment", "Operations Manager - Payment", "Operations Admin - Payment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"application_id", "payment_type"},
     *
     *             @OA\Property(property="application_id", type="integer", example=1, description="ID of the application for which payment is being made"),
     *             @OA\Property(property="payment_type", type="string", enum={"application_fee", "assessment_fee", "certification_fee", "surveillance_fee", "other"}, example="application_fee", description="Type of payment"),
     *             @OA\Property(property="gateway", type="string", enum={"icici_eazypay"}, example="icici_eazypay", description="Payment gateway to use (optional, defaults to icici_eazypay)"),
     *             @OA\Property(property="description", type="string", example="SAMAR Certification Fee for Application", description="Payment description"),
     *             @OA\Property(property="tdsDeductible", type="boolean", example=false, description="Whether the applicant elects a TDS deduction. Honoured only when the matched fee configuration enables TDS."),
     *             @OA\Property(property="tdsPercentage", type="number", format="float", enum={2, 10}, example=2, description="TDS rate elected by the applicant. Required when tdsDeductible is true."),
     *             @OA\Property(property="contact_person_name", type="string", example="John Doe", description="Contact person name (optional, defaults to user name)"),
     *             @OA\Property(property="fee_description", type="string", example="SAMAR Certification Fee", description="Fee description (optional)")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="Payment initiated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Payment initiated successfully."),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="payment",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="payment_number", type="string", example="PAY-2025-000001"),
     *                     @OA\Property(property="application_id", type="integer", example=1),
     *                     @OA\Property(property="payment_type", type="string", example="application_fee"),
     *                     @OA\Property(property="amount", type="number", format="float", example=5000.00),
     *                     @OA\Property(property="currency", type="string", example="INR"),
     *                     @OA\Property(property="status", type="string", example="pending"),
     *                     @OA\Property(property="gateway", type="string", example="icici_eazypay"),
     *                     @OA\Property(property="gateway_payment_id", type="string", nullable=true, example=null),
     *                     @OA\Property(property="paid_at", type="string", format="date-time", nullable=true, example=null),
     *                     @OA\Property(property="created_at", type="string", format="date-time", example="2025-01-15T10:25:00+05:30")
     *                 ),
     *                 @OA\Property(
     *                     property="gateway_data",
     *                     type="object",
     *                     @OA\Property(property="gateway_order_id", type="string", example="order_ABC123XYZ"),
     *                     @OA\Property(property="key", type="string", example="rzp_test_ABC123"),
     *                     @OA\Property(property="amount", type="integer", example=500000, description="Amount in smallest currency unit (paise for INR)"),
     *                     @OA\Property(property="currency", type="string", example="INR"),
     *                     @OA\Property(property="name", type="string", example="QCI SAMAR"),
     *                     @OA\Property(property="description", type="string", example="Payment for PAY-2025-000001")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=403,
     *         description="Unauthorized to create payment for this application",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Unauthorized to create payment for this application.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Validation failed",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=422,
     *         description="Application is not payment pending, or no fee configuration exists for it",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="No fee configuration for sector \"manufacturing\" and enterprise size \"micro\"."),
     *             @OA\Property(property="errors", type="object")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Failed to initiate payment",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to initiate payment."),
     *             @OA\Property(property="error", type="string", example="Gateway connection error")
     *         )
     *     )
     * )
     */
    /**
     * Quote the fee payable for an application.
     *
     * The payment screen renders this instead of deriving the figure itself, so the
     * amount the applicant sees and the amount charged come from one calculation.
     */
    #[OA\Get(
        path: '/api/v1/applications/{applicationId}/fee',
        summary: 'Quote the fee payable for an application',
        description: 'Returns the fee breakdown resolved from fee_configurations for the application\'s sector and enterprise size. TDS is applied only where the matched configuration enables it.',
        tags: ['Payment'],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'applicationId',
                in: 'path',
                required: true,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'tdsDeductible',
                in: 'query',
                required: false,
                description: 'Whether the applicant elects a TDS deduction',
                schema: new OA\Schema(type: 'boolean'),
            ),
            new OA\Parameter(
                name: 'tdsPercentage',
                in: 'query',
                required: false,
                description: 'TDS rate; required when tdsDeductible is true',
                schema: new OA\Schema(type: 'number', enum: [2, 10]),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Fee breakdown',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'success', type: 'boolean', example: true),
                        new OA\Property(
                            property: 'data',
                            type: 'object',
                            properties: [
                                new OA\Property(property: 'baseCertificationFee', type: 'number', example: 35000),
                                new OA\Property(property: 'foodAccommodation', type: 'number', example: 2000),
                                new OA\Property(property: 'amountPayable', type: 'number', example: 37000),
                                new OA\Property(property: 'gstPercentage', type: 'number', example: 18),
                                new OA\Property(property: 'gstAmount', type: 'number', example: 6660),
                                new OA\Property(property: 'tdsAvailable', type: 'boolean', example: true),
                                new OA\Property(property: 'tdsDeductible', type: 'boolean', example: false),
                                new OA\Property(property: 'tdsPercentage', type: 'number', example: 0),
                                new OA\Property(property: 'tdsAmount', type: 'number', example: 0),
                                new OA\Property(property: 'totalAmount', type: 'number', example: 43660),
                            ],
                        ),
                    ],
                ),
            ),
            new OA\Response(response: 403, description: 'Unauthorized for this application'),
            new OA\Response(response: 404, description: 'Application not found'),
            new OA\Response(response: 422, description: 'No fee configuration matches the application'),
        ],
    )]
    public function fee(Request $request, int $applicationId, FeeCalculator $feeCalculator): JsonResponse
    {
        // Query strings carry "true"/"false", which the boolean rule rejects.
        $request->merge(['tds_deductible' => $request->boolean('tds_deductible')]);

        $validator = Validator::make($request->all(), [
            'tds_deductible' => 'nullable|boolean',
            'tds_percentage' => 'nullable|numeric|in:2,10|required_if:tds_deductible,true',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $application = Application::find($applicationId);

        if (! $application) {
            return $this->errorResponse('Application not found.', 404);
        }

        $user = $request->user();

        if ($user->hasAnyRole([Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN])
            && $application->organization_id !== $user->organization_id) {
            return $this->errorResponse('Unauthorized to view the fee for this application.', 403);
        }

        try {
            $fee = $feeCalculator->forApplication(
                $application,
                $request->boolean('tds_deductible'),
                $request->has('tds_percentage') ? (float) $request->input('tds_percentage') : null
            );
        } catch (BusinessException $e) {
            return $this->errorResponse($e->getMessage(), 422);
        }

        $breakdown = $fee['metadata'];

        return $this->successResponse([
            'base_certification_fee' => $breakdown['base_fee'],
            'food_accommodation' => $breakdown['food_accommodation'],
            'amount_payable' => round($breakdown['base_fee'] + $breakdown['food_accommodation'], 2),
            'gst_percentage' => $breakdown['gst_percentage'],
            'gst_amount' => $breakdown['gst_amount'],
            'tds_available' => $fee['tdsAvailable'],
            'tds_deductible' => $breakdown['tds_deductible'],
            'tds_percentage' => $breakdown['tds_percentage'],
            'tds_amount' => $breakdown['tds_amount'],
            'total_amount' => $fee['total'],
        ], 'Fee retrieved successfully.');
    }

    public function initiate(Request $request, FeeCalculator $feeCalculator): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'application_id' => 'required|exists:applications,id',
            'payment_type' => 'required|in:application_fee,assessment_fee,certification_fee,surveillance_fee,other',
            'tds_deductible' => 'nullable|boolean',
            'tds_percentage' => 'nullable|numeric|in:2,10|required_if:tds_deductible,true',
            'gateway' => 'nullable|in:icici_eazypay',
            'description' => 'nullable|string',
            'contact_person_name' => 'nullable|string|max:50',
            'fee_description' => 'nullable|string|max:80',
            'gstin' => 'nullable|string|max:15',
            'tan' => 'nullable|string|max:10',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 400, $validator->errors()->toArray());
        }

        $user = $request->user();

        // Only enterprise users can initiate payments
        if (! $user->hasAnyRole([Role::ENTERPRISE_ADMIN, Role::UNIT_ADMIN])) {
            return $this->errorResponse('Only enterprise users can initiate payments.', 403);
        }

        $application = Application::with('organization')->find($request->application_id);

        if (! $application) {
            return $this->errorResponse('Application not found.', 404);
        }

        if ($application->status !== 'payment_pending') {
            return $this->errorResponse('Application is not in payment pending status.', 422);
        }

        // Verify user has access to this application
        if ($application->organization_id !== $user->organization_id) {
            return $this->errorResponse('Unauthorized to create payment for this application.', 403);
        }

        // The amount is resolved from fee_configurations, never taken from the request.
        // Older web builds send the TDS election inside `metadata` rather than as
        // top-level fields, so fall back to it while those builds are still deployed.
        $clientMetadata = $request->input('metadata', []);
        $tdsDeductible = $request->has('tds_deductible')
            ? $request->boolean('tds_deductible')
            : (bool) ($clientMetadata['tds_deductible'] ?? false);
        $tdsPercentage = $request->has('tds_percentage')
            ? (float) $request->input('tds_percentage')
            : (isset($clientMetadata['tds_percentage']) ? (float) $clientMetadata['tds_percentage'] : null);

        try {
            $fee = $feeCalculator->forApplication($application, $tdsDeductible, $tdsPercentage);
        } catch (BusinessException $e) {
            // Anything that is not a BusinessException falls through to the global
            // handler, which answers with a generic message and a reference id. A
            // catch for \InvalidArgumentException used to sit here and echo its
            // message — that type is shared with every library in vendor/, so the
            // text was not ours to trust.
            return $this->errorResponse($e->getMessage(), 422);
        }

        $amount = $fee['total'];

        try {
            DB::beginTransaction();

            // Generate payment number
            $paymentNumber = $this->generatePaymentNumber();

            // Get organization details for ICICI EazyPay mandatory fields
            $organization = $application->organization;

            $gstin = $request->gstin ?: null;
            $tan = $request->tan ?: null;

            $paymentBreakdown = $fee['metadata'];

            $payment = Payment::create([
                'application_id' => $request->application_id,
                'organization_id' => $application->organization_id,
                'user_id' => $user->id,
                'payment_id' => $paymentNumber,
                'order_id' => $paymentNumber,
                'payment_type' => $request->payment_type,
                'amount' => $amount,
                'net_amount' => $amount, // Net amount before gateway fees
                'currency' => 'INR',
                'status' => 'pending',
                'gateway' => $request->gateway ?? config('services.payment.default_gateway', 'icici_eazypay'),
                'customer_name' => $user->full_name ?? $user->first_name.' '.$user->last_name,
                'customer_email' => $user->email,
                'customer_phone' => $user->mobile_number,
                'gstin' => $gstin,
                'tan' => $tan,
                'description' => $request->description,
                'metadata' => $paymentBreakdown, // Server-computed breakdown, read back by Payment::getBreakdownAttribute()
            ]);

            // Initialize payment with gateway
            $gateway = PaymentGatewayFactory::create($payment->gateway);

            // Build gateway-specific data
            // ICICI EazyPay requires additional fields from the organization
            $gatewayData = [
                'amount' => $payment->amount,
                'currency' => $payment->currency,
                'order_id' => $payment->payment_id,
                'notes' => [
                    'application_id' => $application->id,
                    'payment_id' => $payment->id,
                    'payment_type' => $payment->payment_type,
                ],
                // ICICI EazyPay mandatory fields (populated from organization)
                'utr_number' => $payment->payment_id,
                'customer_email' => $organization->email ?? $user->email,
                'customer_mobile' => $organization->mobile_number ?? $user->mobile_number ?? '',
                'pan' => $organization->pan ?? '',
                'tan' => $payment->tan ?? '',
                'gstin' => $payment->gstin ?? '',
                'unit_address' => $application->unit_address ?? '',
                'address_line_2' => '',
                'district' => $application->unit_district ?? '',
                'pin_code' => $application->unit_pincode ?? '',
                'state' => $application->unit_state ?? '',
                'country' => 'India',
                'fee_description' => $request->fee_description ?? $this->getFeeDescription($request->payment_type),
                'contact_person_name' => $request->contact_person_name ?? $user->full_name ?? $user->name ?? '',
                'payment_date' => now()->format('d/M/Y'),
            ];

            // Log payment initiation request (no PII)
            Log::info('ICICI EazyPay payment initiation request', [
                'payment_id' => $payment->id,
                'application_id' => $application->id,
                'gateway' => $payment->gateway,
                'amount' => $payment->amount,
            ]);

            $gatewayResponse = $gateway->initiatePayment($gatewayData);

            Log::info('ICICI EazyPay gateway response', [
                'payment_id' => $payment->id,
                'payment_url' => $gatewayResponse['payment_url'] ?? 'NOT SET',
                'reference_no' => $gatewayResponse['reference_no'] ?? 'NOT SET',
                'return_url_configured' => config('services.icici_eazypay.return_url'),
                'gateway_response' => $gatewayResponse,
            ]);

            // Update payment with gateway details (merge with existing metadata to preserve breakdown)
            $payment->update([
                'gateway_order_id' => $gatewayResponse['gateway_order_id'] ?? $gatewayResponse['reference_no'],
                'metadata' => array_merge($payment->metadata ?? [], ['gateway_response' => $gatewayResponse]),
            ]);

            DB::commit();

            return $this->successResponse([
                'payment' => $this->formatPayment($payment->fresh()),
                'gateway_data' => $gatewayResponse,
            ], 'Payment initiated successfully.', 201);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Payment initiation failed: '.$e->getMessage());

            return $this->serverErrorResponse($e, 'Failed to initiate payment.');
        }
    }

    /**
     * Get fee description based on payment type.
     */
    private function getFeeDescription(string $paymentType): string
    {
        return match ($paymentType) {
            'application_fee' => 'SAMAR Application Fee',
            'assessment_fee' => 'SAMAR Assessment Fee',
            'certification_fee' => 'SAMAR Certification Fee',
            'surveillance_fee' => 'SAMAR Surveillance Fee',
            default => 'SAMAR Certification Fee',
        };
    }

    /**
     * Verify payment after completion.
     *
     * @OA\Post(
     *     path="/api/v1/payments/{id}/verify",
     *     summary="Verify payment",
     *     description="Verifies a payment after the user completes the payment process with the gateway. This endpoint validates the payment signature and updates the payment status accordingly.",
     *     tags={"Payment", "System Admin - Payment", "DRDO Admin - Payment", "Operations Manager - Payment", "Operations Admin - Payment"},
     *     security={{"bearerAuth":{}}},
     *
     *     @OA\Parameter(
     *         name="id",
     *         in="path",
     *         description="Payment ID",
     *         required=true,
     *
     *         @OA\Schema(type="integer", example=1)
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"gateway_payment_id"},
     *
     *             @OA\Property(property="gateway_payment_id", type="string", example="pay_ABC123XYZ", description="Payment ID from the payment gateway"),
     *             @OA\Property(property="gateway_order_id", type="string", example="order_ABC123XYZ", description="Order ID from the payment gateway (optional)"),
     *             @OA\Property(property="gateway_signature", type="string", example="abc123def456...", description="Signature from the payment gateway for verification")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Payment verified successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="Payment verified successfully."),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(
     *                     property="payment",
     *                     type="object",
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="payment_number", type="string", example="PAY-2025-000001"),
     *                     @OA\Property(property="application_id", type="integer", example=1),
     *                     @OA\Property(property="payment_type", type="string", example="application_fee"),
     *                     @OA\Property(property="amount", type="number", format="float", example=5000.00),
     *                     @OA\Property(property="currency", type="string", example="INR"),
     *                     @OA\Property(property="status", type="string", example="success"),
     *                     @OA\Property(property="gateway", type="string", example="icici_eazypay"),
     *                     @OA\Property(property="gateway_payment_id", type="string", example="pay_ABC123XYZ"),
     *                     @OA\Property(property="paid_at", type="string", format="date-time", example="2025-01-15T10:30:00+05:30"),
     *                     @OA\Property(property="created_at", type="string", format="date-time", example="2025-01-15T10:25:00+05:30")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=400,
     *         description="Bad request - Validation failed or payment verification failed",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed."),
     *             @OA\Property(property="errors", type="object", nullable=true),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 nullable=true,
     *                 @OA\Property(property="payment", type="object")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=401,
     *         description="Unauthenticated",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Unauthenticated.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=404,
     *         description="Payment not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="message", type="string", example="Payment not found.")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=500,
     *         description="Failed to verify payment",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Failed to verify payment."),
     *             @OA\Property(property="error", type="string", example="Gateway verification error")
     *         )
     *     )
     * )
     *
     * @param  Request  $request
     * @param  int  $id
     * @return JsonResponse
     */

    /**
     * Generate unique payment reference using timestamp and random suffix.
     *
     * Format: TXN{timestamp_ms}{4_hex_chars} (e.g., TXN1705312345678A3F9)
     * Globally unique across all environments without database coordination.
     */
    private function generatePaymentNumber(): string
    {
        $maxRetries = 5;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            $attempt++;

            // Generate timestamp-based reference with random suffix
            // Format: TXN{timestamp_ms}{4_random_chars} - globally unique across environments
            $timestamp = (int) (microtime(true) * 1000); // Milliseconds
            $randomSuffix = strtoupper(bin2hex(random_bytes(2))); // 4 hex chars
            $paymentNumber = 'TXN'.$timestamp.$randomSuffix;

            // Safety check for uniqueness (collision practically impossible)
            if (! Payment::where('payment_id', $paymentNumber)->exists()) {
                return $paymentNumber;
            }

            Log::warning('Payment number collision detected', [
                'payment_number' => $paymentNumber,
                'attempt' => $attempt,
            ]);

            usleep(1000); // 1ms delay before retry
        }

        // Fallback with additional entropy
        $fallbackNumber = 'TXN'.(int) (microtime(true) * 1000).strtoupper(bin2hex(random_bytes(4)));
        Log::warning('Using fallback payment number', [
            'payment_number' => $fallbackNumber,
        ]);

        return $fallbackNumber;
    }

    /**
     * Export the Payment History list as CSV.
     */
    #[OA\Get(
        path: '/api/v1/payments/export',
        summary: 'Export payments',
        description: 'Exports the Payment History list as CSV, honouring the same filters and the same role-based data scoping as the list endpoint. Assessors and DRDO Lab users cannot export payments.',
        tags: [
            'Payment',
            'System Admin - Payment',
            'DRDO Admin - Payment',
            'Operations Manager - Payment',
            'Operations Admin - Payment',
        ],
        security: [['bearerAuth' => []]],
        parameters: [
            new OA\Parameter(
                name: 'search',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string', minLength: 2, maxLength: 100),
            ),
            new OA\Parameter(
                name: 'applicationId',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'integer'),
            ),
            new OA\Parameter(
                name: 'paymentType',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'sector',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string', enum: ['manufacturing', 'service']),
            ),
            new OA\Parameter(
                name: 'enterpriseClassification',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string'),
            ),
            new OA\Parameter(
                name: 'fromDate',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
            new OA\Parameter(
                name: 'toDate',
                in: 'query',
                required: false,
                schema: new OA\Schema(type: 'string', format: 'date'),
            ),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'CSV file download',
                content: [
                    new OA\MediaType(
                        mediaType: 'text/csv',
                        schema: new OA\Schema(type: 'string', format: 'binary'),
                    ),
                ],
            ),
            new OA\Response(response: 401, description: 'Unauthenticated'),
            new OA\Response(response: 403, description: 'Not authorized to export payments'),
            new OA\Response(response: 500, description: 'Server error'),
        ],
    )]
    public function export(PaymentExportRequest $request): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        // Same gate as the list: assessors and DRDO Lab users have no payment access.
        if ($user->hasAnyRole([Role::ASSESSOR, Role::DRDO_LAB])) {
            return $this->errorResponse('You are not authorized to export payments.', 403);
        }

        try {
            // Rows are streamed in chunks rather than collected up front, so memory
            // stays flat however many payments match. chunkById drives the order, so
            // no orderBy is set here.
            $exportQuery = $this->buildListQuery($request, $user);

            $filename = 'payments_export_'.now()->format('Y-m-d_His').'.csv';

            $headers = [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="'.$filename.'"',
                'Pragma' => 'no-cache',
                'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
                'Expires' => '0',
            ];

            $callback = function () use ($exportQuery) {
                $file = fopen('php://output', 'w');

                // Add BOM for UTF-8 Excel compatibility
                fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                fputcsv($file, [
                    'ID',
                    'Payment Number',
                    'Application Number',
                    'Organization Name',
                    'Unit Name',
                    'Sector',
                    'Enterprise Classification',
                    'Payment Type',
                    'Amount',
                    'Currency',
                    'Status',
                    'Gateway',
                    'Gateway Transaction ID',
                    'GSTIN',
                    'TAN',
                    'Paid By',
                    'Failure Reason',
                    'Paid At',
                    'Created At',
                ]);

                $exportQuery->chunkById(500, function ($payments) use ($file) {
                    foreach ($payments as $payment) {
                        Csv::putRow($file, [
                            $payment->id,
                            $payment->payment_id ?? '',
                            $payment->application?->application_number ?? '',
                            $payment->application?->organization?->name ?? '',
                            $payment->application?->unit_name ?? '',
                            $payment->application?->sector ?? '',
                            $payment->application?->enterprise_classification ?? '',
                            $payment->payment_type ?? '',
                            $payment->amount,
                            $payment->currency ?? '',
                            $payment->status,
                            $payment->gateway ?? '',
                            $payment->gateway_payment_id ?? '',
                            $payment->gstin ?? '',
                            $payment->tan ?? '',
                            $payment->paidBy?->full_name ?? '',
                            $payment->failure_reason ?? '',
                            $payment->completed_at?->toDateTimeString() ?? '',
                            $payment->created_at->toDateTimeString(),
                        ]);
                    }
                });

                fclose($file);
            };

            return response()->stream($callback, 200, $headers);
        } catch (\Exception $e) {
            Log::error('Failed to export payments', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id,
            ]);

            return $this->errorResponse('Failed to export payments.', 500);
        }
    }

    /**
     * The Payment History query, shared by the list and the CSV export so the
     * exported rows can never be a different set from the rows on screen.
     */
    private function buildListQuery(Request $request, User $user)
    {
        $query = Payment::with(['application.organization', 'application.latestInvoice', 'paidBy']);

        // Settled payments only, on purpose. An unsettled row is an attempt in
        // flight, not a payment, and the scheduled verification sweep resolves it
        // without anyone looking. Do not widen this to surface pending rows without
        // deciding who should see a half-finished attempt.
        $query->whereIn('status', ['success', 'failed']);

        // Scope by organization (and unit, for unit admins) via parent application
        if (! $user->hasAnyRole(['system_admin', 'drdo_admin', 'operations_manager', 'operations_admin'])) {
            if ($user->hasRole(Role::UNIT_ADMIN)) {
                $userUnitIds = $user->assignedUnitIds();
                $query->whereHas('application', function ($q) use ($user, $userUnitIds) {
                    $q->where('organization_id', $user->organization_id)
                        ->whereIn('unit_id', $userUnitIds);
                });
            } else {
                $query->whereHas('application', function ($q) use ($user) {
                    $q->where('organization_id', $user->organization_id);
                });
            }
        }

        // Apply state-based filtering for Operations Manager
        $this->stateFilterService->applyToPaymentQuery($query, $user);

        // Apply search
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search);
            $query->where(function ($q) use ($search) {
                $q->where('order_id', 'LIKE', "%{$search}%")
                    ->orWhere('transaction_id', 'LIKE', "%{$search}%")
                    ->orWhereHas('application', fn ($q) => $q->where('application_number', 'LIKE', "%{$search}%")
                        ->orWhere('unit_name', 'LIKE', "%{$search}%")
                    );
            });
        }

        // Apply filters
        if ($request->has('application_id')) {
            $query->where('application_id', $request->application_id);
        }

        if ($request->has('payment_type')) {
            $query->where('payment_type', $request->payment_type);
        }

        // Filter by the parent application's sector / enterprise size. The web
        // Payment History screens send `sector` and `enterpriseClassification`;
        // ConvertRequestToSnakeCase rewrites query keys to snake_case before this
        // runs, so read `enterprise_classification` here (not the wire camelCase).
        if ($request->filled('sector')) {
            $sector = $request->input('sector');
            $query->whereHas('application', fn ($q) => $q->where('sector', $sector));
        }

        if ($request->filled('enterprise_classification')) {
            $classification = $request->input('enterprise_classification');
            $query->whereHas('application', fn ($q) => $q->where('enterprise_classification', $classification));
        }

        // Date range over created_at, which is also what the list is ordered by, so
        // the range means the same thing as the order on screen. A payment's completed_at
        // is null while it is failed or pending, so ordering or filtering on that would
        // silently drop the very rows the failed total is counting. Both ends inclusive.
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->input('to_date'));
        }

        return $query;
    }

    /**
     * Format payment data for response.
     */
    private function formatPayment(Payment $payment, bool $detailed = false): array
    {
        // The application's latest invoice carries the ERP-issued PDFs surfaced on
        // Payment History; attaching them here lets the grid offer the documents
        // without a second request per organisation.
        $invoice = $payment->application?->latestInvoice;

        $data = [
            'id' => $payment->id,
            'payment_number' => $payment->payment_id,
            'application_id' => $payment->application_id,
            'payment_type' => $payment->payment_type,
            'amount' => $payment->amount,
            'currency' => $payment->currency,
            'status' => $payment->status,
            'gateway' => $payment->gateway,
            'gateway_payment_id' => $payment->gateway_payment_id,
            'paid_at' => $payment->completed_at?->toIso8601String(),
            'created_at' => $payment->created_at->toIso8601String(),
            // Always include basic application info for list views
            'application_number' => $payment->application?->application_number,
            'organization_name' => $payment->application?->organization?->name,
            'unit_name' => $payment->application?->unit_name,
            'unit_address' => $payment->application?->unit_address,
            'application_status' => $payment->application?->status,
            'sector' => $payment->application?->sector,
            'enterprise_classification' => $payment->application?->enterprise_classification,
            // Tax identification numbers
            'gstin' => $payment->gstin,
            'tan' => $payment->tan,
            // Payment breakdown from model accessor (extracts from metadata)
            'breakdown' => $payment->breakdown,
            // ERP-issued documents from the application's latest invoice
            'invoice_id' => $invoice?->id,
            'invoice_pdf_available' => $invoice !== null && $invoice->invoice_pdf_path !== null,
            'receipt_pdf_available' => $invoice !== null && $invoice->receipt_pdf_path !== null,
        ];

        if ($detailed) {
            $data['application'] = $payment->application ? [
                'id' => $payment->application->id,
                'application_number' => $payment->application->application_number,
                'organization' => [
                    'id' => $payment->application->organization->id,
                    'name' => $payment->application->organization->name,
                ],
            ] : null;

            $data['paid_by'] = $payment->paidBy ? [
                'id' => $payment->paidBy->id,
                'name' => $payment->paidBy->full_name,
                'email' => $payment->paidBy->email,
            ] : null;

            $data['description'] = $payment->description;
            $data['failure_reason'] = $payment->failure_reason;
        }

        return $data;
    }
}
