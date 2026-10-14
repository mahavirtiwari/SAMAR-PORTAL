<?php

use App\Support\ContentBlockDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-editable instructions, declarations and disclaimers shown across the
 * portal. The defaults are the texts that were previously hardcoded, so the
 * app reads the same until an admin edits a block.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_blocks', function (Blueprint $table) {
            $table->id();
            $table->string('key', 100)->unique();
            $table->string('group', 50)->index();
            $table->string('title');
            $table->string('description', 500)->nullable();
            $table->enum('format', ['html', 'text'])->default('html');
            $table->longText('body');
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        DB::table('content_blocks')->insert(array_map(fn (array $block) => [
            'key' => $block['key'],
            'group' => $block['group'],
            'title' => $block['title'],
            'description' => $block['description'],
            'format' => $block['format'],
            'body' => $block['body'],
            'created_at' => $now,
            'updated_at' => $now,
        ], ContentBlockDefaults::all()));
    }

    public function down(): void
    {
        Schema::dropIfExists('content_blocks');
    }
};
