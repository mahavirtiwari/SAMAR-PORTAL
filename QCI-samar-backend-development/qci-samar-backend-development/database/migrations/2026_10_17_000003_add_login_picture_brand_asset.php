<?php

use App\Support\BrandAssetDefaults;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Settings → Branding & Logos gains the login page picture.
 */
return new class extends Migration
{
    public function up(): void
    {
        $asset = BrandAssetDefaults::find('login_picture');
        if ($asset && ! DB::table('brand_assets')->where('key', 'login_picture')->exists()) {
            DB::table('brand_assets')->insert([
                'key' => $asset['key'],
                'title' => $asset['title'],
                'description' => $asset['description'],
                'link_url' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
        Cache::forget('brand_assets.all');
    }

    public function down(): void
    {
        DB::table('brand_assets')->where('key', 'login_picture')->delete();
        Cache::forget('brand_assets.all');
    }
};
