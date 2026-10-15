<?php

use App\Support\ContentBlockDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Makes the assessment report's "About SAMAR Assessment" and "Methodology"
 * texts editable in Settings → Content & Disclaimers. The defaults are the
 * texts the report printed until now.
 */
return new class extends Migration
{
    private const KEYS = ['assessment_report_about', 'assessment_report_methodology'];

    public function up(): void
    {
        $now = now();
        foreach (self::KEYS as $key) {
            $block = ContentBlockDefaults::find($key);
            if ($block === null || DB::table('content_blocks')->where('key', $key)->exists()) {
                continue;
            }
            DB::table('content_blocks')->insert([
                'key' => $block['key'],
                'group' => $block['group'],
                'title' => $block['title'],
                'description' => $block['description'],
                'format' => $block['format'],
                'body' => $block['body'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('content_blocks')->whereIn('key', self::KEYS)->delete();
    }
};
