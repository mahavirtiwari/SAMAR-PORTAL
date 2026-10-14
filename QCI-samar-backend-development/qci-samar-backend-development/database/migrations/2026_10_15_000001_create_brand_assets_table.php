<?php

use App\Support\BrandAssetDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Replaceable logos (Settings → Branding & Logos). A row with no file_path
 * uses the built-in image; link_url is where the logo leads when clicked.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('brand_assets', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->string('title');
            $table->string('description', 500)->nullable();
            $table->string('file_path')->nullable();
            $table->string('mime_type', 50)->nullable();
            $table->string('link_url', 500)->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        DB::table('brand_assets')->insert(array_map(fn (array $asset) => [
            'key' => $asset['key'],
            'title' => $asset['title'],
            'description' => $asset['description'],
            'link_url' => $asset['link_url'],
            'created_at' => $now,
            'updated_at' => $now,
        ], BrandAssetDefaults::all()));
    }

    public function down(): void
    {
        Schema::dropIfExists('brand_assets');
    }
};
