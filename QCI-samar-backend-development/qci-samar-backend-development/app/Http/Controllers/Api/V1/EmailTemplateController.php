<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Settings\UpdateEmailTemplateRequest;
use App\Mail\NotificationMail;
use App\Models\EmailNotificationTemplate;
use App\Services\Email\EmailTemplateEditor;
use App\Support\HtmlSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use OpenApi\Attributes as OA;

#[OA\Tag(
    name: 'Email Templates',
    description: 'System Admin management of transactional email templates (Settings → Email Templates).',
)]
class EmailTemplateController extends Controller
{
    public function __construct(
        private EmailTemplateEditor $editor,
        private HtmlSanitizer $sanitizer,
    ) {}

    #[OA\Get(
        path: '/api/v1/admin/email-templates',
        operationId: 'listEmailTemplates',
        tags: ['Email Templates'],
        summary: 'List all transactional email templates',
        security: [['bearerAuth' => []]],
        responses: [
            new OA\Response(response: 200, description: 'Email templates retrieved successfully'),
            new OA\Response(response: 403, description: 'Only System Admin can manage email templates'),
        ],
    )]
    public function index(): JsonResponse
    {
        $templates = EmailNotificationTemplate::query()
            ->orderBy('category')
            ->orderBy('name')
            ->get()
            ->map(fn (EmailNotificationTemplate $t) => [
                'id' => $t->id,
                'slug' => $t->slug,
                'name' => $t->name,
                'description' => $t->description,
                'category' => $t->category,
                'event' => $t->event,
                'subject' => $t->subject,
                'recipient_roles' => $t->recipient_roles ?? [],
                'is_active' => (bool) $t->is_active,
                'is_customized' => $t->body !== null,
                'customized_at' => $t->customized_at,
                'updated_at' => $t->updated_at,
            ]);

        return $this->successResponse($templates, 'Email templates retrieved successfully');
    }

    #[OA\Get(
        path: '/api/v1/admin/email-templates/{id}',
        operationId: 'getEmailTemplate',
        tags: ['Email Templates'],
        summary: 'Get an email template with its editable content and placeholders',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Email template retrieved successfully'),
            new OA\Response(response: 404, description: 'Email template not found'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        $template = EmailNotificationTemplate::findOrFail($id);

        return $this->successResponse($this->detail($template), 'Email template retrieved successfully');
    }

    #[OA\Put(
        path: '/api/v1/admin/email-templates/{id}',
        operationId: 'updateEmailTemplate',
        tags: ['Email Templates'],
        summary: 'Update an email template',
        description: 'Updates the subject, heading, body (HTML with {{placeholders}}, sanitised on save), CC/BCC, recipient roles and active state.',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(content: new OA\JsonContent(properties: [
            new OA\Property(property: 'subject', type: 'string'),
            new OA\Property(property: 'title', type: 'string', nullable: true),
            new OA\Property(property: 'body', type: 'string', nullable: true),
            new OA\Property(property: 'cc', type: 'array', items: new OA\Items(type: 'string')),
            new OA\Property(property: 'bcc', type: 'array', items: new OA\Items(type: 'string')),
            new OA\Property(property: 'recipientRoles', type: 'array', items: new OA\Items(type: 'string')),
            new OA\Property(property: 'isActive', type: 'boolean'),
        ])),
        responses: [
            new OA\Response(response: 200, description: 'Email template updated successfully'),
            new OA\Response(response: 422, description: 'Validation error'),
        ],
    )]
    public function update(UpdateEmailTemplateRequest $request, int $id): JsonResponse
    {
        $template = EmailNotificationTemplate::findOrFail($id);
        $data = $request->validated();

        if (array_key_exists('body', $data)) {
            $body = $this->sanitizer->clean($data['body']);
            // Saving the untouched default (e.g. only the subject changed) must
            // not freeze a copy of it: keep rendering the Blade view instead.
            $default = $this->editor->defaultContent($template)['body'] ?? null;
            if ($body === '' || ($default !== null && $this->normalise($body) === $this->normalise($this->sanitizer->clean($default)))) {
                $body = null;
            }
            $data['body'] = $body;
            $data['customized_at'] = $body === null ? null : now();
        }
        if (array_key_exists('title', $data) && $data['title'] !== null) {
            $data['title'] = trim(strip_tags($data['title']));
        }

        $template->fill($data + ['updated_by' => $request->user()->id])->save();

        return $this->successResponse($this->detail($template->fresh()), 'Email template updated successfully');
    }

    #[OA\Post(
        path: '/api/v1/admin/email-templates/{id}/preview',
        operationId: 'previewEmailTemplate',
        tags: ['Email Templates'],
        summary: 'Render a template (optionally with unsaved edits) using sample data',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Preview rendered')],
    )]
    public function preview(Request $request, int $id): JsonResponse
    {
        $template = EmailNotificationTemplate::findOrFail($id);
        $request->validate([
            'subject' => ['nullable', 'string', 'max:500'],
            'title' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:200000'],
        ]);

        $rendered = $this->renderSample($template, $request);
        $rendered['html'] = $this->inlineEmailImages($rendered['html']);

        return $this->successResponse($rendered, 'Preview rendered');
    }

    /**
     * Embeds the layout's images (logo, footer) as data URIs for the in-portal
     * preview: the web app's CSP only allows images from itself and data:, so
     * API-hosted image URLs would show as broken there. Real emails keep the
     * hosted URLs.
     */
    private function inlineEmailImages(string $html): string
    {
        return preg_replace_callback('#https?://[^"\'\s]+/(images/emails/[A-Za-z0-9_.-]+\.(png|jpe?g|gif))#i', function (array $m) {
            $path = public_path($m[1]);
            if (! is_file($path)) {
                return $m[0];
            }
            $mime = strtolower($m[2]) === 'png' ? 'image/png' : (strtolower($m[2]) === 'gif' ? 'image/gif' : 'image/jpeg');

            return 'data:'.$mime.';base64,'.base64_encode((string) file_get_contents($path));
        }, $html);
    }

    #[OA\Post(
        path: '/api/v1/admin/email-templates/{id}/test',
        operationId: 'sendTestEmailTemplate',
        tags: ['Email Templates'],
        summary: "Send the template, with sample data, to the signed-in admin's email",
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Test email sent')],
    )]
    public function sendTest(Request $request, int $id): JsonResponse
    {
        $template = EmailNotificationTemplate::findOrFail($id);
        $request->validate([
            'subject' => ['nullable', 'string', 'max:500'],
            'title' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:200000'],
        ]);
        $admin = $request->user();
        $rendered = $this->renderSample($template, $request);

        try {
            Mail::to($admin->email)->send(new NotificationMail(
                '[TEST] '.$rendered['subject'],
                $rendered['html'],
                trim(strip_tags($rendered['html'])),
            ));
        } catch (\Throwable $e) {
            Log::error('Test email could not be sent', ['template' => $template->slug, 'error' => $e->getMessage()]);

            return $this->errorResponse('The test email could not be sent. Check the mail configuration.', 502);
        }

        return $this->successResponse(['sent_to' => $admin->email], 'Test email sent to '.$admin->email);
    }

    #[OA\Post(
        path: '/api/v1/admin/email-templates/{id}/reset',
        operationId: 'resetEmailTemplate',
        tags: ['Email Templates'],
        summary: 'Discard the customised heading and body and use the built-in design again',
        security: [['bearerAuth' => []]],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'integer'))],
        responses: [new OA\Response(response: 200, description: 'Email template reset to default')],
    )]
    public function reset(Request $request, int $id): JsonResponse
    {
        $template = EmailNotificationTemplate::findOrFail($id);
        $template->fill([
            'title' => null,
            'body' => null,
            'customized_at' => null,
            'updated_by' => $request->user()->id,
        ])->save();

        return $this->successResponse($this->detail($template->fresh()), 'Email template reset to default');
    }

    /**
     * @return array{subject: string, html: string}
     */
    private function renderSample(EmailNotificationTemplate $template, Request $request): array
    {
        $data = $this->editor->sampleData($template);
        $body = $request->filled('body') ? $this->sanitizer->clean($request->input('body')) : null;
        $title = $request->filled('title') ? strip_tags($request->input('title')) : null;
        $subject = $request->filled('subject') ? $request->input('subject') : (string) $template->subject;

        return [
            'subject' => $this->editor->fill($subject, $data, false),
            'html' => $this->editor->render($template, $data, $title, $body),
        ];
    }

    private function normalise(string $html): string
    {
        return preg_replace('/\s+/', ' ', trim($html));
    }

    private function detail(EmailNotificationTemplate $template): array
    {
        $default = $this->editor->defaultContent($template);

        return [
            'id' => $template->id,
            'slug' => $template->slug,
            'name' => $template->name,
            'description' => $template->description,
            'category' => $template->category,
            'event' => $template->event,
            'subject' => $template->subject,
            'title' => $template->title ?? ($default['title'] ?? null),
            'body' => $template->body ?? ($default['body'] ?? null),
            'is_customized' => $template->body !== null,
            'default_available' => $default !== null,
            'cc' => $template->cc ?? [],
            'bcc' => $template->bcc ?? [],
            'recipient_roles' => $template->recipient_roles ?? [],
            'recipient_role_options' => UpdateEmailTemplateRequest::RECIPIENT_ROLES,
            'send_to_creator' => (bool) $template->send_to_creator,
            'has_attachment' => (bool) $template->has_attachment,
            'is_active' => (bool) $template->is_active,
            'placeholders' => $this->editor->placeholdersFor($template),
            'customized_at' => $template->customized_at,
            'updated_at' => $template->updated_at,
        ];
    }
}
