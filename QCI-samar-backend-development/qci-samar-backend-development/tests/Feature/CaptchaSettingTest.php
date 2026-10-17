<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Services\Auth\CaptchaService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * The security code (CAPTCHA) on the browser auth forms: six characters mixing
 * letters and digits, and a System Settings switch that turns it off.
 */
class CaptchaSettingTest extends TestCase
{
    use RefreshDatabase;

    private function browserRequest(): Request
    {
        $request = Request::create('/api/v1/auth/login', 'POST');
        $request->headers->set('Origin', config('cors.allowed_origins')[0]);

        return $request;
    }

    public function test_the_code_is_six_characters_with_letters_and_digits(): void
    {
        for ($i = 0; $i < 25; $i++) {
            $response = $this->getJson('/api/v1/auth/captcha')->assertOk();
            $response->assertJsonPath('data.enabled', true);
            $this->assertStringStartsWith('data:image/png;base64,', $response->json('data.image'));

            $phrase = Cache::get('captcha:'.$response->json('data.captchaId'));
            $this->assertMatchesRegularExpression('/^[a-z0-9]{6}$/', $phrase);
            $this->assertMatchesRegularExpression('/[a-z]/', $phrase, 'At least one letter.');
            $this->assertMatchesRegularExpression('/[0-9]/', $phrase, 'At least one digit.');
        }
    }

    public function test_the_code_is_on_by_default_for_browser_forms(): void
    {
        $this->assertTrue(SystemSetting::isCaptchaEnabled());
        $this->assertTrue(app(CaptchaService::class)->isRequiredFor($this->browserRequest()));
    }

    public function test_switching_it_off_hides_the_code_and_stops_asking_for_it(): void
    {
        SystemSetting::setValue('captcha_enabled', '0');

        $this->getJson('/api/v1/auth/captcha')
            ->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.image', null)
            ->assertJsonPath('data.captchaId', null);

        $this->assertFalse(app(CaptchaService::class)->isRequiredFor($this->browserRequest()));

        SystemSetting::setValue('captcha_enabled', '1');
        $this->assertTrue(app(CaptchaService::class)->isRequiredFor($this->browserRequest()));
    }

    public function test_the_system_admin_can_switch_it_through_system_settings(): void
    {
        $this->assertDatabaseHas('system_settings', ['key' => 'captcha_enabled', 'value' => '1']);
    }
}
