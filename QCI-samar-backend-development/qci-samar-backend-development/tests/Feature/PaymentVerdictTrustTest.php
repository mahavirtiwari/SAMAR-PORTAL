<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\Organization;
use App\Models\Payment;
use App\Models\Role;
use App\Models\Unit;
use App\Models\User;
use App\Services\Payment\ICICIEazyPayAdapter;
use App\Services\Payment\PaymentSettlementService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Only verdicts we can prove came from ICICI may settle a payment: a return
 * callback with a valid RS signature, or the gateway's own answer to a
 * server-to-server status query. Unsigned callbacks and push notifications
 * trigger that query instead of being trusted.
 */
class PaymentVerdictTrustTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = '1234567890123456';

    private Application $application;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->seed(RoleSeeder::class);

        config([
            'services.icici_eazypay.encryption_key' => self::KEY,
            'services.icici_eazypay.merchant_id' => '123456',
            'services.icici_eazypay.verify_url' => 'https://gateway.test/EazyPGVerify',
            'app.frontend_url' => 'https://web.test',
        ]);

        $organization = Organization::factory()->create();
        $admin = User::factory()->create(['organization_id' => $organization->id]);
        $admin->roles()->attach(Role::where('slug', Role::ENTERPRISE_ADMIN)->firstOrFail()->id, [
            'organization_id' => $organization->id,
            'unit_id' => null,
            'is_active' => true,
            'assigned_at' => now(),
        ]);
        $unit = Unit::create([
            'organization_id' => $organization->id,
            'name' => 'Pune Plant',
            'address' => 'Plot 1, Industrial Area',
            'state' => 'Maharashtra',
            'district' => 'Pune',
            'pincode' => '411001',
            'unit_type' => 'manufacturing',
            'status' => 'active',
        ]);
        $this->application = Application::create([
            'organization_id' => $organization->id,
            'organization_name' => $organization->name,
            'unit_id' => $unit->id,
            'unit_name' => $unit->name,
            'unit_state' => 'Maharashtra',
            'application_number' => 'SAMAR-APP-'.uniqid(),
            'application_type' => 'new',
            'sector' => 'manufacturing',
            'enterprise_classification' => 'micro',
            'enterprise_name' => 'Acme Defence',
            'contact_person_name' => 'Jane Doe',
            'contact_person_email' => 'jane@example.com',
            'gst_certificate_file' => 'applications/1/certs/gst.pdf',
            'status' => 'payment_pending',
            'payment_status' => 'pending',
        ]);
    }

    private function makePayment(string $status = 'pending', ?string $gatewayPaymentId = null): Payment
    {
        return Payment::create([
            'payment_type' => 'application_fee',
            'application_id' => $this->application->id,
            'organization_id' => $this->application->organization_id,
            'payment_id' => 'PAY-'.uniqid(),
            'order_id' => 'ORD-'.uniqid(),
            'gateway_order_id' => 'REF-'.uniqid(),
            'gateway_payment_id' => $gatewayPaymentId,
            'gateway' => 'icici_eazypay',
            'amount' => 25000,
            'net_amount' => 25000,
            'currency' => 'INR',
            'status' => $status,
        ]);
    }

    private function fakeGatewayStatus(string $body): void
    {
        Http::fake(['*EazyPGVerify*' => Http::response($body, 200)]);
    }

    /** Callback query as ICICI sends it, optionally signed with the merchant key. */
    private function callbackParams(Payment $payment, string $responseCode, bool $signed): array
    {
        $params = [
            'Response Code' => $responseCode,
            'Unique Ref Number' => 'TRN-CB-1',
            'Service Tax Amount' => '0',
            'Processing Fee Amount' => '0',
            'Total Amount' => '25000',
            'Transaction Amount' => '25000',
            'Transaction Date' => '14-10-2026 10:00:00',
            'Interchange Value' => '',
            'TDR' => '',
            'Payment Mode' => 'NET_BANKING',
            'SubMerchantId' => '1',
            'ReferenceNo' => $payment->gateway_order_id,
            'ID' => '123456',
            'TPS' => 'Y',
        ];
        $fields = ['ID', 'Response Code', 'Unique Ref Number', 'Service Tax Amount', 'Processing Fee Amount', 'Total Amount',
            'Transaction Amount', 'Transaction Date', 'Interchange Value', 'TDR', 'Payment Mode', 'SubMerchantId', 'ReferenceNo', 'TPS'];
        $params['RS'] = $signed
            ? hash('sha512', implode('|', array_map(fn ($f) => $params[$f], $fields)).'|'.self::KEY)
            : str_repeat('0', 128);

        return $params;
    }

    private function callbackUrl(array $params): string
    {
        return '/api/payments/icici-eazypay/callback?'.http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    }

    /** Encrypted push notification body, as ICICI posts it. */
    private function pushBody(array $fields): string
    {
        $xml = '<XML>'.implode('', array_map(fn ($k, $v) => "<$k>$v</$k>", array_keys($fields), $fields)).'</XML>';

        return base64_encode(openssl_encrypt($xml, 'AES-128-ECB', self::KEY, OPENSSL_RAW_DATA));
    }

    public function test_an_unsigned_failure_callback_does_not_fail_a_payment_the_gateway_still_has_open(): void
    {
        $payment = $this->makePayment();
        $this->fakeGatewayStatus('status=Challan Generated');

        $response = $this->get($this->callbackUrl($this->callbackParams($payment, 'E00329', signed: false)));

        $response->assertRedirect();
        $this->assertStringContainsString('status=pending', $response->headers->get('Location'));
        $this->assertSame('pending', $payment->refresh()->status);
    }

    public function test_an_unsigned_failure_callback_fails_the_payment_once_the_gateway_confirms_it(): void
    {
        $payment = $this->makePayment();
        $this->fakeGatewayStatus('status=Failed&pgreferenceno='.$payment->gateway_order_id);

        $response = $this->get($this->callbackUrl($this->callbackParams($payment, 'E007', signed: false)));

        $this->assertStringContainsString('status=failed', $response->headers->get('Location'));
        $this->assertSame('failed', $payment->refresh()->status);
    }

    public function test_an_unsigned_success_callback_settles_only_on_the_gateways_confirmation(): void
    {
        $payment = $this->makePayment();
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN7001&amount=25000.00&PaymentMode=NB');

        $response = $this->get($this->callbackUrl($this->callbackParams($payment, 'E000', signed: false)));

        $this->assertStringContainsString('status=success', $response->headers->get('Location'));
        $payment->refresh();
        $this->assertSame('success', $payment->status);
        $this->assertSame('TRN7001', $payment->gateway_payment_id);
    }

    public function test_a_signed_failure_callback_is_still_a_verdict_on_its_own(): void
    {
        $payment = $this->makePayment();
        Http::fake();

        $this->get($this->callbackUrl($this->callbackParams($payment, 'E007', signed: true)));

        $this->assertSame('failed', $payment->refresh()->status);
        Http::assertNothingSent();
    }

    public function test_a_signed_success_callback_settles_without_a_gateway_round_trip(): void
    {
        $payment = $this->makePayment();
        Http::fake();

        $this->get($this->callbackUrl($this->callbackParams($payment, 'E000', signed: true)));

        $this->assertSame('success', $payment->refresh()->status);
        Http::assertNothingSent();
    }

    public function test_a_success_push_is_not_trusted_until_the_gateway_confirms_it(): void
    {
        $payment = $this->makePayment(gatewayPaymentId: 'TRN5001');
        $this->fakeGatewayStatus('status=Challan Generated');

        $this->call('POST', '/api/webhooks/payments/icici-eazypay', [], [], [], ['CONTENT_TYPE' => 'text/plain'],
            $this->pushBody(['TrnId' => 'TRN5001', 'ResponseCode' => 'E000', 'Status' => 'Success', 'TranAmt' => '25000']))
            ->assertOk();

        $this->assertSame('pending', $payment->refresh()->status, 'A push alone must not settle a payment.');
    }

    public function test_a_success_push_settles_once_the_gateway_confirms_it(): void
    {
        $payment = $this->makePayment(gatewayPaymentId: 'TRN5002');
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN5002&amount=25000.00&PaymentMode=NB');

        $this->call('POST', '/api/webhooks/payments/icici-eazypay', [], [], [], ['CONTENT_TYPE' => 'text/plain'],
            $this->pushBody(['TrnId' => 'TRN5002', 'ResponseCode' => 'E000', 'Status' => 'Success', 'TranAmt' => '25000']))
            ->assertOk();

        $this->assertSame('success', $payment->refresh()->status);
    }

    public function test_a_push_without_a_transaction_id_touches_no_payment(): void
    {
        // gateway_payment_id is null: a where() on a null TrnId used to match it.
        $payment = $this->makePayment();
        $this->fakeGatewayStatus('status=Success&ezpaytranid=X&amount=25000.00');

        $this->call('POST', '/api/webhooks/payments/icici-eazypay', [], [], [], ['CONTENT_TYPE' => 'text/plain'],
            $this->pushBody(['ResponseCode' => 'E000', 'Status' => 'Success', 'TranAmt' => '25000']))
            ->assertOk();

        $payment->refresh();
        $this->assertSame('pending', $payment->status);
        $this->assertNull($payment->webhook_payload);
        Http::assertNothingSent();
    }

    public function test_a_gateway_confirmed_success_recovers_a_payment_marked_failed_earlier(): void
    {
        $payment = $this->makePayment('failed');
        $this->fakeGatewayStatus('status=Success&ezpaytranid=TRN6001&amount=25000.00&PaymentMode=NB');

        $outcome = app(PaymentSettlementService::class)->verifyAndSettle($payment, new ICICIEazyPayAdapter, 'test');

        $this->assertSame('success', $outcome['verdict']);
        $this->assertSame('success', $payment->refresh()->status);
        $this->application->refresh();
        $this->assertSame('success', $this->application->payment_status);
        $this->assertNotSame('payment_pending', $this->application->status);
    }

    public function test_a_failure_verdict_never_downgrades_a_successful_payment(): void
    {
        $payment = $this->makePayment('success');

        $settled = app(PaymentSettlementService::class)->settleFailure($payment, ['failure_reason' => 'late failure'], 'test');

        $this->assertFalse($settled);
        $this->assertSame('success', $payment->refresh()->status);
    }
}
