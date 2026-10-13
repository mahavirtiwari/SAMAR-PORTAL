<?php

namespace App\Services\Gst;

use App\Contracts\GstinVerifierInterface;
use App\Models\GstinVerification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * GSTIN verification via the Protean eGov GVS API.
 *
 *   POST {base_url}
 *   Headers: UserID, Password, GSTINID
 *   Response: flat JSON, Status = S (success) / R (rejected), with Error_Cd + Reason.
 *
 * The API only answers for source IPs Protean has whitelisted; an unwhitelisted
 * call returns ERR_10010. The response schema is documented two ways (PascalCase
 * wrappers in the sample payloads, raw GSTN keys in the schema sheet), so the
 * field mapping reads PascalCase first and falls back to the raw keys — cheap
 * insurance until the live shape is confirmed. The full raw payload is stored on
 * the record for diagnosis.
 *
 * @see Verify_GSTIN_API_Documentation.docx (Protean eGov GVS API Interface 2.0)
 */
class ProteanGstinVerifier implements GstinVerifierInterface
{
    /**
     * Error codes where the GSTIN itself is the problem (a definitive rejection),
     * as opposed to an auth / IP / session / technical failure on our side.
     * ERR_10029 ("Gstin is Required") is deliberately excluded — that is a
     * caller-side error, not a rejection of a supplied GSTIN.
     */
    private const REJECTION_CODES = ['FO8007', 'ERR_10015', 'RET13510'];

    private bool $enabled;

    private string $baseUrl;

    private string $userId;

    private string $password;

    private int $timeout;

    private int $cacheTtlDays;

    public function __construct()
    {
        $config = config('services.gstin', []);
        $protean = $config['protean'] ?? [];

        $this->enabled = (bool) ($config['enabled'] ?? false);
        $this->cacheTtlDays = (int) ($config['cache_ttl_days'] ?? 30);
        $this->baseUrl = rtrim($protean['base_url'] ?? 'https://gstlite.proteantech.in/STP/GetGstn', '/');
        $this->userId = (string) ($protean['user_id'] ?? '');
        $this->password = (string) ($protean['password'] ?? '');
        $this->timeout = (int) ($protean['timeout'] ?? 30);
    }

    public function isEnabled(): bool
    {
        return $this->enabled && $this->userId !== '' && $this->password !== '';
    }

    public function providerName(): string
    {
        return 'protean';
    }

    public function verify(string $gstin, bool $forceRefresh = false): GstinVerificationResult
    {
        $gstin = strtoupper(trim($gstin));

        if ($gstin === '') {
            return new GstinVerificationResult(
                gstin: $gstin,
                verified: false,
                status: 'error',
                reason: 'No GSTIN supplied.',
                provider: $this->providerName(),
            );
        }

        if (! $forceRefresh) {
            $cached = $this->freshCachedResult($gstin);
            if ($cached !== null) {
                return $cached;
            }
        }

        $result = $this->call($gstin);
        $this->store($result);

        return $result;
    }

    /**
     * A prior successful verification still within the TTL is served without
     * re-calling Protean. Rejections and errors are never cached — they are
     * cheap to re-check and a transient failure must not stick.
     */
    private function freshCachedResult(string $gstin): ?GstinVerificationResult
    {
        $record = GstinVerification::where('gstin', $gstin)->first();

        if ($record === null
            || $record->status !== 'verified'
            || $record->verified_at === null
            || $record->verified_at->lt(now()->subDays($this->cacheTtlDays))) {
            return null;
        }

        return new GstinVerificationResult(
            gstin: $record->gstin,
            verified: true,
            status: 'verified',
            legalName: $record->legal_name,
            tradeName: $record->trade_name,
            constitution: $record->constitution,
            taxpayerType: $record->taxpayer_type,
            gstinStatus: $record->gstin_status,
            registrationDate: $record->registration_date,
            stateJurisdiction: $record->state_jurisdiction,
            centreJurisdiction: $record->centre_jurisdiction,
            natureOfBusiness: $record->nature_of_business,
            principalAddress: $record->principal_address,
            raw: $record->raw_response ?? [],
            provider: $record->provider,
        );
    }

    private function call(string $gstin): GstinVerificationResult
    {
        try {
            $http = Http::withHeaders([
                'UserID' => $this->userId,
                'Password' => $this->password,
                'GSTINID' => $gstin,
            ])->timeout($this->timeout);

            // Local Windows PHP often lacks a configured CA bundle; deployed
            // (Azure/Linux) environments verify TLS normally.
            if (app()->environment('local')) {
                $http = $http->withOptions(['verify' => false]);
            }

            // Empty-body POST (Guzzle sends Content-Length: 0, no Content-Type):
            // the GSTIN travels only in the GSTINID header. Do NOT add a request
            // body — a JSON body was observed to hang the endpoint in live testing
            // (30-Jul-2026, dev VM), whereas the empty-body form returns normally.
            $response = $http->post($this->baseUrl);

            if (! $response->successful()) {
                Log::warning('GSTIN verification HTTP failure', [
                    'gstin' => $gstin,
                    'http_status' => $response->status(),
                ]);

                return new GstinVerificationResult(
                    gstin: $gstin,
                    verified: false,
                    status: 'error',
                    reason: "Registry returned HTTP {$response->status()}.",
                    raw: is_array($response->json()) ? $response->json() : [],
                    provider: $this->providerName(),
                );
            }

            return $this->mapResponse($gstin, (array) $response->json());
        } catch (\Throwable $e) {
            Log::error('GSTIN verification exception', [
                'gstin' => $gstin,
                'error' => $e->getMessage(),
            ]);

            return new GstinVerificationResult(
                gstin: $gstin,
                verified: false,
                status: 'error',
                reason: 'Could not reach the GST registry.',
                provider: $this->providerName(),
            );
        }
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function mapResponse(string $gstin, array $body): GstinVerificationResult
    {
        $status = (string) ($this->first($body, ['Status', 'status']) ?? '');
        $errorCode = $this->nullableString($this->first($body, ['Error_Cd', 'error_cd']));
        $reason = $this->nullableString($this->first($body, ['Reason', 'reason']));
        $legalName = $this->nullableString($this->first($body, ['NameOfCompany', 'lgnm']));

        // Status=S is transport success ("the request was processed"), NOT proof
        // the GSTIN is valid: Protean answers Status=S even for a GSTIN it has no
        // record of, returning every registry field blank with Reason
        // "Invalid GSTIN / UID". A real taxpayer always carries a legal name, so
        // that — not Status alone — is the signal of a genuine record.
        // (Confirmed against live responses on the dev VM, 30-Jul-2026.)
        if ($status === 'S' && $legalName !== null) {
            return new GstinVerificationResult(
                gstin: $gstin,
                verified: true,
                status: 'verified',
                legalName: $legalName,
                tradeName: $this->nullableString($this->first($body, ['TradeName', 'tradeNam'])),
                constitution: $this->nullableString($this->first($body, ['TypeOfCompany', 'ConstitutionOfBusiness', 'ctb'])),
                taxpayerType: $this->nullableString($this->first($body, ['TaxpayerType', 'TaxPayerType', 'dty'])),
                gstinStatus: $this->nullableString($this->first($body, ['StatusOfCompany', 'sts'])),
                registrationDate: $this->nullableString($this->first($body, ['RegistrationDate', 'rgdt'])),
                stateJurisdiction: $this->nullableString($this->first($body, ['StateJurisdictionCode', 'StateJurisdiction', 'stj'])),
                centreJurisdiction: $this->nullableString($this->first($body, ['CentreJurisdiction', 'CentreJurisdictionCode', 'ctj'])),
                natureOfBusiness: $this->nullableString($this->first($body, ['NatureOfBusinessActivity', 'nba'])),
                principalAddress: $this->principalAddress($body),
                raw: $body,
                provider: $this->providerName(),
            );
        }

        // Non-verified: distinguish a genuine rejection of the GSTIN from a
        // technical/auth/IP failure on our side, so ops and the applicant get
        // the right message even though a hard gate blocks on either. A processed
        // request (Status=S) that found no taxpayer is a definitive rejection;
        // otherwise only the known rejection error codes are treated as such.
        $isRejection = ($status === 'S' && $legalName === null)
            || ($errorCode !== null && in_array($errorCode, self::REJECTION_CODES, true));

        return new GstinVerificationResult(
            gstin: $gstin,
            verified: false,
            status: $isRejection ? 'rejected' : 'error',
            errorCode: $errorCode,
            reason: $reason,
            raw: $body,
            provider: $this->providerName(),
        );
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, string>|null
     */
    private function principalAddress(array $body): ?array
    {
        // Live Protean nests the address under PrincipalAddress.Address with its
        // own key names (and a "BuilingName" typo); the documented sample carries
        // flat top-level keys instead. Read the nested object when present, and
        // in either case accept both spellings so both shapes map cleanly.
        $nested = $body['PrincipalAddress']['Address'] ?? null;
        $source = is_array($nested) ? $nested : $body;

        $parts = [
            'building_name' => $this->nullableString($this->first($source, ['BuilingName', 'BuildingName'])),
            'door_num' => $this->nullableString($this->first($source, ['DoorNum', 'BuildingNo'])),
            'floor_name' => $this->nullableString($this->first($source, ['FloorName', 'FloorNo'])),
            'street' => $this->nullableString($this->first($source, ['Street'])),
            'location' => $this->nullableString($this->first($source, ['Loc', 'Location'])),
            'district' => $this->nullableString($this->first($source, ['District'])),
            'city' => $this->nullableString($this->first($source, ['City'])),
            'state' => $this->nullableString($this->first($source, ['StateName', 'StateCode'])),
            'pincode' => $this->nullableString($this->first($source, ['PinCode'])),
        ];

        $parts = array_filter($parts, static fn ($v) => $v !== null);

        return $parts === [] ? null : $parts;
    }

    private function store(GstinVerificationResult $result): void
    {
        $now = now();

        $attributes = [
            'provider' => $result->provider,
            'status' => $result->status,
            'error_code' => $result->errorCode,
            'reason' => $result->reason,
            'raw_response' => $result->raw,
            'last_checked_at' => $now,
        ];

        // A successful verification refreshes the whole registry snapshot and
        // stamps verified_at. A rejection/error records its diagnostics but
        // preserves the last-known-good snapshot and verified_at for audit.
        if ($result->verified) {
            $attributes += [
                'legal_name' => $result->legalName,
                'trade_name' => $result->tradeName,
                'constitution' => $result->constitution,
                'taxpayer_type' => $result->taxpayerType,
                'gstin_status' => $result->gstinStatus,
                'registration_date' => $result->registrationDate,
                'state_jurisdiction' => $result->stateJurisdiction,
                'centre_jurisdiction' => $result->centreJurisdiction,
                'nature_of_business' => $result->natureOfBusiness,
                'principal_address' => $result->principalAddress,
                'verified_at' => $now,
            ];
        }

        GstinVerification::updateOrCreate(['gstin' => $result->gstin], $attributes);
    }

    /**
     * First present, non-null value among the candidate keys.
     *
     * @param  array<string, mixed>  $body
     * @param  array<int, string>  $keys
     */
    private function first(array $body, array $keys): mixed
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $body) && $body[$key] !== null) {
                return $body[$key];
            }
        }

        return null;
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' || strtoupper($value) === 'NA' ? null : $value;
    }
}
