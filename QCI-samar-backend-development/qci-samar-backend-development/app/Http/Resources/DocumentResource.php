<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'title' => $this->title,
            'name' => $this->name,
            'original_filename' => $this->original_filename,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'size_human' => $this->formatBytes($this->size),
            'extension' => $this->extension,
            'is_active' => $this->is_active,
            'uploaded_by' => [
                'id' => $this->uploader?->id,
                'name' => $this->uploader?->full_name,
                'email' => $this->uploader?->email,
            ],
            'uploaded_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Format bytes to human-readable size.
     */
    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2).' '.$units[$i];
    }
}
