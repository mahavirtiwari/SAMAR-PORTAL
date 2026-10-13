<?php

namespace App\Services\BusinessCentral\Payloads;

use App\Contracts\GstinVerifierInterface;
use App\Models\Application;
use App\Models\Customer;
use App\Services\BusinessCentral\BcStates;
use App\Services\Gst\GstinConsistencyValidator;

/**
 * Assembles the ProcessCustomer payload from the live Organization/Application.
 *
 * Field lengths come from BC's OData metadata (authoritative, 16-Jul-2026);
 * chunking splits long names/addresses across the continuation fields instead
 * of truncating. Posting groups, Lab_ID, TAN and Assessment_Type stay blank per
 * QCI's confirmation — BC derives them from its Customer Integration Setup.
 */
class CustomerPayloadBuilder
{
    public function __construct(
        private GstinConsistencyValidator $gstinValidator,
        private GstinVerifierInterface $gstinVerifier,
    ) {}

    public function build(Customer $customer): array
    {
        $organization = $customer->organization;
        $application = Application::where('organization_id', $organization->id)
            ->orderByDesc('id')
            ->first();

        $state = BcStates::canonical($organization->registered_state);
        if ($state === null) {
            throw new \InvalidArgumentException(
                "State '{$organization->registered_state}' does not match Business Central's state master; correct it before pushing."
            );
        }

        [$name1, $name2] = $this->chunk((string) $organization->name, [100, 300]);
        [$addr1, $addr2, $addr3] = $this->chunk((string) $organization->registered_address, [100, 50, 200]);

        $pan = strtoupper(trim((string) $organization->pan));
        $gstin = strtoupper(trim((string) ($application->gst_number ?? '')));
        $this->gstinValidator->assert($application->gst_number ?? '', $organization->pan, $organization->registered_state);

        // Pre-push gate: a registered customer's GSTIN must be verified against
        // the registry before it reaches Business Central. Normally this reads
        // the cached verification stamped at submission; it only re-calls Protean
        // if that has expired. Throws (consistent with the assert above) so the
        // push job retries rather than sending an unverified GSTIN to the ERP.
        if ($gstin !== '' && $this->gstinVerifier->isEnabled()) {
            $verification = $this->gstinVerifier->verify($gstin);
            if (! $verification->verified) {
                throw new \InvalidArgumentException(
                    "GSTIN {$gstin} is not verified with the GST registry (status: {$verification->status}"
                        .($verification->errorCode !== null ? ", code: {$verification->errorCode}" : '')
                        .'); resolve before pushing to Business Central.'
                );
            }
        }

        return [
            'Created_At' => now()->toIso8601String(),
            'Board' => config('services.business_central.board'),
            'Portal_Name' => config('services.business_central.portal_name'),
            'Reference_No' => $customer->reference_no,
            'Lab_ID' => '',
            'Client_Name_1' => $name1,
            'Client_Name_2' => $name2,
            'Address_1' => $addr1,
            'Address_2' => $addr2,
            'Address_3' => $addr3,
            'City' => mb_substr((string) $organization->registered_district, 0, 100),
            'District' => mb_substr((string) $organization->registered_district, 0, 50),
            'State' => $state,
            'Country' => 'India',
            'Pincode' => mb_substr((string) $organization->registered_pincode, 0, 10),
            'SPOC_Name' => mb_substr((string) $organization->owner_name, 0, 80),
            'Mobile' => mb_substr((string) $organization->mobile_number, 0, 15),
            'Email' => mb_substr((string) $organization->email, 0, 80),
            'Head_Phone_No' => mb_substr((string) $organization->owner_mobile_number, 0, 15),
            'Organisation_Head_Email' => mb_substr((string) $organization->owner_email, 0, 80),
            'PAN' => mb_substr($pan, 0, 10),
            'TAN' => '',
            'TAN_Based_GST' => '',
            'GST_Customer_Type' => $gstin !== '' ? 'Registered' : 'Unregistered',
            'GSTIN' => mb_substr($gstin, 0, 15),
            'HOD_Name' => '',
            'Trade_Name' => mb_substr((string) $organization->name, 0, 150),
            'Legal_Name' => mb_substr((string) $organization->name, 0, 150),
            'Certificate_No' => '',
            'MSME_Type' => ' ',
            'MSME_Registration_No' => mb_substr((string) ($application->udyam_registration_number ?? ''), 0, 20),
        ];
    }

    /**
     * Split a string across consecutive fields of the given lengths.
     * Returns exactly count($lengths) segments (empty-padded).
     */
    private function chunk(string $value, array $lengths): array
    {
        $segments = [];
        $offset = 0;
        foreach ($lengths as $length) {
            $segments[] = mb_substr($value, $offset, $length);
            $offset += $length;
        }

        return $segments;
    }
}
