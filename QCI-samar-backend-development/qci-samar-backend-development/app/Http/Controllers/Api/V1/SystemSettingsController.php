<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="System Settings",
 *     description="API Endpoints for managing system-wide configuration settings. Read access for all authenticated users, write access for System Admin only."
 * )
 */
class SystemSettingsController extends Controller
{
    /**
     * Get all system settings.
     *
     * @OA\Get(
     *     path="/api/v1/system-settings",
     *     operationId="getSystemSettings",
     *     tags={"System Settings"},
     *     summary="Get all system settings",
     *     description="Returns a list of all system settings. Accessible to all authenticated users.",
     *     security={{"bearerAuth": {}}},
     *     x={"roles": {"system_admin", "drdo_admin", "drdo_lab", "operations_manager", "operations_admin", "assessor", "unit_admin", "enterprise_admin"}},
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="System settings retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="array",
     *
     *                 @OA\Items(
     *
     *                     @OA\Property(property="id", type="integer", example=1),
     *                     @OA\Property(property="key", type="string", example="site_name"),
     *                     @OA\Property(property="value", type="string", example="QCI Samar Portal"),
     *                     @OA\Property(property="description", type="string", example="The name of the site", nullable=true),
     *                     @OA\Property(property="created_at", type="string", format="date-time"),
     *                     @OA\Property(property="updated_at", type="string", format="date-time")
     *                 )
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated")
     * )
     */
    public function index(): JsonResponse
    {
        $settings = SystemSetting::all();

        return $this->successResponse($settings, 'System settings retrieved successfully');
    }

    /**
     * Get a single setting by key.
     *
     * @OA\Get(
     *     path="/api/v1/system-settings/{key}",
     *     operationId="getSystemSetting",
     *     tags={"System Settings"},
     *     summary="Get a system setting by key",
     *     description="Returns a single system setting by its key. Accessible to all authenticated users.",
     *     security={{"bearerAuth": {}}},
     *     x={"roles": {"system_admin", "drdo_admin", "drdo_lab", "operations_manager", "operations_admin", "assessor", "unit_admin", "enterprise_admin"}},
     *
     *     @OA\Parameter(
     *         name="key",
     *         in="path",
     *         description="Setting key",
     *         required=true,
     *
     *         @OA\Schema(type="string", example="site_name")
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="Successful operation",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="System setting retrieved successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="key", type="string", example="site_name"),
     *                 @OA\Property(property="value", type="string", example="QCI Samar Portal"),
     *                 @OA\Property(property="description", type="string", example="The name of the site", nullable=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(
     *         response=404,
     *         description="Setting not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Setting not found")
     *         )
     *     )
     * )
     */
    public function show(string $key): JsonResponse
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (! $setting) {
            return $this->errorResponse('Setting not found', 404);
        }

        return $this->successResponse($setting, 'System setting retrieved successfully');
    }

    /**
     * Create a new setting.
     *
     * @OA\Post(
     *     path="/api/v1/system-settings",
     *     operationId="storeSystemSetting",
     *     tags={"System Settings"},
     *     summary="Create a new system setting",
     *     description="Create a new system setting with a unique key. Requires System Admin role.",
     *     security={{"bearerAuth": {}}},
     *     x={"roles": {"system_admin"}},
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"key", "value"},
     *
     *             @OA\Property(property="key", type="string", maxLength=100, example="site_name", description="Unique setting key"),
     *             @OA\Property(property="value", type="string", example="QCI Samar Portal", description="Setting value"),
     *             @OA\Property(property="description", type="string", maxLength=255, example="The name of the site", description="Optional description of the setting")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=201,
     *         description="System setting created successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="System setting created successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="key", type="string", example="site_name"),
     *                 @OA\Property(property="value", type="string", example="QCI Samar Portal"),
     *                 @OA\Property(property="description", type="string", example="The name of the site", nullable=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden - System Admin role required"),
     *     @OA\Response(
     *         response=422,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="key", type="array", @OA\Items(type="string", example="The key has already been taken."))
     *             )
     *         )
     *     )
     * )
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'key' => 'required|string|max:100|unique:system_settings,key',
            'value' => 'required',
            'description' => 'nullable|string|max:255',
        ]);

        $setting = SystemSetting::setValue($request->key, $request->value, $request->description);

        return $this->successResponse($setting, 'System setting created successfully', 201);
    }

    /**
     * Update a setting by key.
     *
     * @OA\Put(
     *     path="/api/v1/system-settings/{key}",
     *     operationId="updateSystemSetting",
     *     tags={"System Settings"},
     *     summary="Update a system setting",
     *     description="Update an existing system setting by its key. Requires System Admin role.",
     *     security={{"bearerAuth": {}}},
     *     x={"roles": {"system_admin"}},
     *
     *     @OA\Parameter(
     *         name="key",
     *         in="path",
     *         description="Setting key",
     *         required=true,
     *
     *         @OA\Schema(type="string", example="site_name")
     *     ),
     *
     *     @OA\RequestBody(
     *         required=true,
     *
     *         @OA\JsonContent(
     *             required={"value"},
     *
     *             @OA\Property(property="value", type="string", example="QCI Samar Portal Updated", description="New setting value"),
     *             @OA\Property(property="description", type="string", maxLength=255, example="Updated description", description="Optional updated description")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=200,
     *         description="System setting updated successfully",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=true),
     *             @OA\Property(property="message", type="string", example="System setting updated successfully"),
     *             @OA\Property(
     *                 property="data",
     *                 type="object",
     *                 @OA\Property(property="id", type="integer", example=1),
     *                 @OA\Property(property="key", type="string", example="site_name"),
     *                 @OA\Property(property="value", type="string", example="QCI Samar Portal Updated"),
     *                 @OA\Property(property="description", type="string", example="Updated description", nullable=true),
     *                 @OA\Property(property="created_at", type="string", format="date-time"),
     *                 @OA\Property(property="updated_at", type="string", format="date-time")
     *             )
     *         )
     *     ),
     *
     *     @OA\Response(response=401, description="Unauthenticated"),
     *     @OA\Response(response=403, description="Forbidden - System Admin role required"),
     *     @OA\Response(
     *         response=404,
     *         description="Setting not found",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Setting not found")
     *         )
     *     ),
     *
     *     @OA\Response(
     *         response=422,
     *         description="Validation error",
     *
     *         @OA\JsonContent(
     *
     *             @OA\Property(property="success", type="boolean", example=false),
     *             @OA\Property(property="message", type="string", example="Validation failed"),
     *             @OA\Property(
     *                 property="errors",
     *                 type="object",
     *                 @OA\Property(property="value", type="array", @OA\Items(type="string", example="The value field is required."))
     *             )
     *         )
     *     )
     * )
     */
    public function update(Request $request, string $key): JsonResponse
    {
        $setting = SystemSetting::where('key', $key)->first();

        if (! $setting) {
            return $this->errorResponse('Setting not found', 404);
        }

        $request->validate([
            'value' => 'required',
            'description' => 'nullable|string|max:255',
        ]);

        $setting = SystemSetting::setValue($key, $request->value, $request->description);

        return $this->successResponse($setting, 'System setting updated successfully');
    }
}
