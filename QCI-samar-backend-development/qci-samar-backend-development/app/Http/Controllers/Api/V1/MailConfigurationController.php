<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Mail\NotificationMail;
use App\Models\MailConfiguration;
use App\Services\Email\MailConfigurationApplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Email Server',
    description: 'System Admin management of the outgoing mail server (Settings → Email Server).',
)]
class MailConfigurationController extends Controller
{
    #[OA\Get(
        path: '/api/v1/admin/mail-settings',
        operationId: 'getMailSettings',
        tags: ['Email Server'],
        summary: 'Get the outgoing mail server settings (password never returned)',
        security: [['bearerAuth' => []]],
        responses: [new OA\Response(response: 200, description: 'Mail settings retrieved successfully')],
    )]
    public function show(): JsonResponse
    {
        return $this->successResponse($this->detail(MailConfiguration::current()), 'Mail settings retrieved successfully');
    }

    #[OA\Put(
        path: '/api/v1/admin/mail-settings',
        operationId: 'updateMailSettings',
        tags: ['Email Server'],
        summary: 'Update the outgoing mail server settings',
        description: 'Leave password empty to keep the stored one. While enabled is false the MAIL_* environment settings are used.',
        security: [['bearerAuth' => []]],
        requestBody: new OA\RequestBody(content: new OA\JsonContent(properties: [
            new OA\Property(property: 'enabled', type: 'boolean'),
            new OA\Property(property: 'host', type: 'string'),
            new OA\Property(property: 'port', type: 'integer'),
            new OA\Property(property: 'encryption', type: 'string', enum: ['tls', 'ssl', 'none']),
            new OA\Property(property: 'username', type: 'string'),
            new OA\Property(property: 'password', type: 'string'),
            new OA\Property(property: 'fromAddress', type: 'string'),
            new OA\Property(property: 'fromName', type: 'string'),
        ])),
        responses: [
            new OA\Response(response: 200, description: 'Mail settings updated successfully'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function update(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $config = MailConfiguration::current();

        // Blank password = keep the stored one; clear it explicitly with clear_password.
        if (($data['password'] ?? '') === '') {
            unset($data['password']);
        }
        if ($request->boolean('clear_password')) {
            $data['password'] = null;
        }
        unset($data['clear_password']);

        $config->fill($data + ['updated_by' => $request->user()->id])->save();
        MailConfigurationApplier::forget();

        return $this->successResponse($this->detail($config->fresh()), 'Mail settings updated successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/mail-settings/test',
        operationId: 'testMailSettings',
        tags: ['Email Server'],
        summary: 'Send a test email using the given (or saved) settings',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Test email sent'),
            new OA\Response(response: 502, description: 'The mail server rejected the connection or message'),
        ],
    )]
    public function test(Request $request): JsonResponse
    {
        $data = $this->validated($request, testing: true);
        $request->validate(['to' => ['nullable', 'email']]);

        // Test the form as typed (unsaved), falling back to the stored password.
        $stored = MailConfiguration::current();
        $candidate = new MailConfiguration(array_merge(
            $stored->only(['host', 'port', 'encryption', 'username', 'from_address', 'from_name', 'timeout']),
            array_filter($data, fn ($v) => $v !== null && $v !== ''),
        ));
        $candidate->password = ($data['password'] ?? '') !== '' ? $data['password'] : $stored->password;

        $to = $request->input('to') ?: $request->user()->email;
        $from = $candidate->from_address ?: config('mail.from.address');

        config(['mail.mailers.settings_test' => $candidate->toMailerConfig()]);
        app('mail.manager')->purge('settings_test');

        try {
            Mail::mailer('settings_test')->to($to)->send(
                (new NotificationMail(
                    'SAMAR – test email from the mail server settings',
                    '<p>This is a test email sent from <strong>Settings → Email Server</strong> in the SAMAR portal.</p><p>If you received it, the mail server settings work.</p>',
                    "This is a test email sent from Settings → Email Server in the SAMAR portal.\nIf you received it, the mail server settings work.",
                ))->from($from, $candidate->from_name ?: config('mail.from.name'))
            );
        } catch (\Throwable $e) {
            Log::warning('Mail server test failed', ['host' => $candidate->host, 'error' => $e->getMessage()]);

            return $this->errorResponse('The test email could not be sent: '.$this->shortError($e->getMessage()), 502);
        }

        return $this->successResponse(['sent_to' => $to], 'Test email sent to '.$to);
    }

    private function validated(Request $request, bool $testing = false): array
    {
        $enabled = $request->boolean('enabled');

        return $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'host' => [($enabled || $testing) ? 'required' : 'nullable', 'string', 'max:255'],
            'port' => [($enabled || $testing) ? 'required' : 'nullable', 'integer', 'between:1,65535'],
            'encryption' => ['sometimes', 'in:tls,ssl,none'],
            'username' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:1000'],
            'clear_password' => ['sometimes', 'boolean'],
            'from_address' => [$enabled ? 'required' : 'nullable', 'email', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:255'],
            'timeout' => ['nullable', 'integer', 'between:5,120'],
        ]);
    }

    private function shortError(string $message): string
    {
        $message = trim(preg_replace('/\s+/', ' ', $message));

        return mb_strlen($message) > 300 ? mb_substr($message, 0, 300).'…' : $message;
    }

    private function detail(MailConfiguration $config): array
    {
        return [
            'enabled' => (bool) $config->enabled,
            'host' => $config->host,
            'port' => $config->port,
            'encryption' => $config->encryption ?? 'tls',
            'username' => $config->username,
            'has_password' => $config->getRawOriginal('password') !== null,
            'from_address' => $config->from_address,
            'from_name' => $config->from_name,
            'timeout' => $config->timeout,
            // What is in effect when the custom settings are off.
            'environment_defaults' => MailConfigurationApplier::environmentDefaults(),
            'updated_at' => $config->updated_at,
        ];
    }
}
