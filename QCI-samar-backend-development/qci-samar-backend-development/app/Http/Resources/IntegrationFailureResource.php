<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class IntegrationFailureResource extends JsonResource
{
    /**
     * The operations-facing shape: no exception class, no severity/status, no
     * stack trace — just when it happened, which integration, a plain-English
     * message, and the reference ID ops quote to IT.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
            'category' => self::labelForSource($this->source),
            'details' => self::cleanMessage($this->exception_message),
            'reference_id' => $this->error_id,
        ];
    }

    /**
     * Friendly category label for a captured `source` tag; falls back to the
     * raw source so an unmapped tag stays legible rather than blank.
     */
    private static function labelForSource(?string $source): ?string
    {
        foreach (config('integration_failures.categories') as $category) {
            if (in_array($source, $category['sources'], true)) {
                return $category['label'];
            }
        }

        return $source;
    }

    /**
     * Collapse whitespace and truncate the raw exception message to a single
     * plain-English line for the operations feed.
     */
    private static function cleanMessage(?string $message): string
    {
        $clean = trim((string) preg_replace('/\s+/', ' ', (string) $message));

        return Str::limit($clean, 200);
    }
}
