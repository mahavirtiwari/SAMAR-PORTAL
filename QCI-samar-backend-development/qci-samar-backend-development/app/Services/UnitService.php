<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\Unit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class UnitService
{
    /**
     * Whitelist of allowed fields for unit creation.
     * This prevents mass assignment vulnerabilities.
     */
    private const ALLOWED_UNIT_FIELDS = [
        'organization_id',
        'name',
        'address',
        'state',
        'district',
        'pincode',
        'mobile_number',
        'landline_number',
        'email',
        'alternate_email',
        'commencement_date',
        'contact_person_name',
        'contact_person_designation',
        'contact_person_email',
        'contact_person_mobile_number',
        'unit_type',
        'status',
    ];

    /**
     * Find existing unit by normalized address or create new one.
     * Address uniqueness: organization_id + address + state + district + pincode (case-insensitive, trimmed)
     *
     * @param  array  $unitData  Application data containing unit fields
     *
     * @throws InvalidArgumentException
     */
    public function findOrCreateByAddress(int $organizationId, array $unitData): Unit
    {
        // Validate organization exists
        if (! Organization::where('id', $organizationId)->exists()) {
            throw new InvalidArgumentException(
                "Organization with ID {$organizationId} does not exist"
            );
        }

        // Wrap in transaction with pessimistic locking to prevent race conditions
        return DB::transaction(function () use ($organizationId, $unitData) {
            // Extract and normalize address fields for comparison
            $address = trim($unitData['unit_address'] ?? '');
            $state = trim($unitData['unit_state'] ?? '');
            $district = trim($unitData['unit_district'] ?? '');
            $pincode = trim($unitData['unit_pincode'] ?? '');

            Log::info('Searching for existing unit by normalized address', [
                'organization_id' => $organizationId,
                'address' => $address,
                'state' => $state,
                'district' => $district,
                'pincode' => $pincode,
            ]);

            // Search for existing unit with matching normalized address
            // Use whereRaw for case-insensitive comparison
            // Add lockForUpdate() to prevent race condition on simultaneous requests
            $existingUnit = Unit::where('organization_id', $organizationId)
                ->whereRaw('LOWER(TRIM(address)) = ?', [strtolower($address)])
                ->whereRaw('LOWER(TRIM(state)) = ?', [strtolower($state)])
                ->whereRaw('LOWER(TRIM(district)) = ?', [strtolower($district)])
                ->whereRaw('TRIM(pincode) = ?', [$pincode])
                ->lockForUpdate()
                ->first();

            if ($existingUnit) {
                Log::info('Found existing unit by address', [
                    'unit_id' => $existingUnit->id,
                    'organization_id' => $organizationId,
                ]);

                return $existingUnit;
            }

            // No existing unit found - create new one
            Log::info('No existing unit found, creating new unit');

            return $this->createUnitFromApplication(array_merge($unitData, ['organization_id' => $organizationId]));
        });
    }

    /**
     * Find an existing unit by normalized address without creating one.
     * Same address key as findOrCreateByAddress: organization_id + address + state
     * + district + pincode (case-insensitive, trimmed). Returns null if no match.
     *
     * Used on draft updates so an address edit resolves to an existing unit when one
     * matches, but never silently forks a new unit (which would orphan the draft from
     * the Unit Admin who owns it, since application visibility is unit-scoped).
     */
    public function findByAddress(int $organizationId, array $unitData): ?Unit
    {
        $address = trim($unitData['unit_address'] ?? '');
        $state = trim($unitData['unit_state'] ?? '');
        $district = trim($unitData['unit_district'] ?? '');
        $pincode = trim($unitData['unit_pincode'] ?? '');

        return Unit::where('organization_id', $organizationId)
            ->whereRaw('LOWER(TRIM(address)) = ?', [strtolower($address)])
            ->whereRaw('LOWER(TRIM(state)) = ?', [strtolower($state)])
            ->whereRaw('LOWER(TRIM(district)) = ?', [strtolower($district)])
            ->whereRaw('TRIM(pincode) = ?', [$pincode])
            ->first();
    }

    /**
     * Update a unit's address (and name) in place from application data.
     * Only non-empty fields are applied, so partial draft saves that omit address
     * fields never blank an existing unit. Preserves the unit's identity — and
     * therefore all Unit Admin pivots and data visibility tied to it.
     */
    public function updateUnitAddress(int $unitId, array $unitData): void
    {
        $unit = Unit::find($unitId);
        if (! $unit) {
            return;
        }

        $map = [
            'address' => $unitData['unit_address'] ?? null,
            'state' => $unitData['unit_state'] ?? null,
            'district' => $unitData['unit_district'] ?? null,
            'pincode' => $unitData['unit_pincode'] ?? null,
            'name' => $unitData['unit_name'] ?? null,
        ];

        foreach ($map as $column => $value) {
            if ($value !== null && trim((string) $value) !== '') {
                $unit->{$column} = $value;
            }
        }

        if ($unit->isDirty()) {
            $unit->save();

            Log::info('Unit address updated in place', [
                'unit_id' => $unit->id,
                'organization_id' => (int) $unit->organization_id,
            ]);
        }
    }

    /**
     * Create a unit from application data.
     *
     * @throws InvalidArgumentException
     */
    public function createUnitFromApplication(array $applicationData): Unit
    {
        // Validate required fields
        if (empty($applicationData['organization_id'])) {
            throw new InvalidArgumentException('organization_id is required to create a unit');
        }

        // Validate organization exists
        if (! Organization::where('id', $applicationData['organization_id'])->exists()) {
            throw new InvalidArgumentException(
                "Organization with ID {$applicationData['organization_id']} does not exist"
            );
        }

        // Detect unit type from data
        if (isset($applicationData['products']) && ! empty($applicationData['products'])) {
            $unitType = 'manufacturing';
        } elseif (isset($applicationData['services']) && ! empty($applicationData['services'])) {
            $unitType = 'service';
        } else {
            $unitType = 'manufacturing'; // default
        }

        // Build unit data using only whitelisted fields (explicit mapping)
        $unitData = [
            'organization_id' => (int) $applicationData['organization_id'],
            'name' => $applicationData['unit_name'] ?? null,
            'address' => $applicationData['unit_address'] ?? null,
            'state' => $applicationData['unit_state'] ?? null,
            'district' => $applicationData['unit_district'] ?? null,
            'pincode' => $applicationData['unit_pincode'] ?? null,
            'mobile_number' => $applicationData['unit_mobile'] ?? null,
            'landline_number' => $applicationData['unit_landline'] ?? null,
            'email' => $applicationData['unit_email'] ?? null,
            'alternate_email' => $applicationData['unit_alternate_email'] ?? null,
            'commencement_date' => $applicationData['unit_commencement_date'] ?? null,
            'contact_person_name' => $applicationData['contact_person_name'] ?? null,
            'contact_person_designation' => $applicationData['contact_person_designation'] ?? null,
            'contact_person_email' => $applicationData['contact_person_email'] ?? null,
            'contact_person_mobile_number' => $applicationData['contact_person_mobile'] ?? null,
            'unit_type' => $unitType,
            'status' => 'active',
        ];

        // Filter to only allowed fields (defense in depth)
        $unitData = array_intersect_key($unitData, array_flip(self::ALLOWED_UNIT_FIELDS));

        // Create the unit
        $unit = Unit::create($unitData);

        Log::info('Unit created from application data', [
            'unit_id' => $unit->id,
            'organization_id' => (int) $unit->organization_id,
            'unit_type' => $unitType,
        ]);

        return $unit;
    }
}
