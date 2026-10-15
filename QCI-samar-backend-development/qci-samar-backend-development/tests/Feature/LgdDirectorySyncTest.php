<?php

namespace Tests\Feature;

use App\Models\District;
use App\Models\Organization;
use App\Services\Lgd\LgdDirectory;
use App\Services\Lgd\LgdDirectorySync;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * States/districts follow the shipped LGD download; stored addresses carry LGD codes,
 * and old district spellings resolve to the current LGD district.
 */
class LgdDirectorySyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        LgdDirectory::flush();

        // The pre-2026 masters, as the old seeders left them.
        DB::table('countries')->insert(['id' => 101, 'name' => 'India', 'code' => 'IN', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('states')->insert([
            ['id' => 8, 'country_id' => 101, 'name' => 'DELHI', 'code' => 'DL', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 20, 'country_id' => 101, 'name' => 'MAHARASHTRA', 'code' => 'MH', 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('districts')->insert([
            ['id' => 169, 'state_id' => 8, 'name' => 'SHAHDARA', 'code' => 'SHA', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 400, 'state_id' => 20, 'name' => 'AURANGABAD', 'code' => 'AUR', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 401, 'state_id' => 20, 'name' => 'PUNE', 'code' => 'PUN', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function test_sync_codes_states_and_renames_adds_and_deactivates_districts(): void
    {
        $stats = app(LgdDirectorySync::class)->run();

        $this->assertSame('MAHARASHTRA', DB::table('states')->where('id', 20)->value('name'), 'state names stay as they were');
        $this->assertSame(27, (int) DB::table('states')->where('id', 20)->value('lgd_code'));
        $this->assertSame('MH', DB::table('states')->where('id', 20)->value('code'));

        $renamed = District::find(400);
        $this->assertSame('Chhatrapati Sambhajinagar', $renamed->name);
        $this->assertSame(469, $renamed->lgd_code);
        $this->assertTrue($renamed->is_active);

        $gone = District::find(169);
        $this->assertFalse($gone->is_active);
        $this->assertSame(671, $gone->lgd_code);

        $this->assertSame(36, DB::table('states')->whereNotNull('lgd_code')->count());
        $this->assertSame(784, District::where('is_active', true)->count());
        $this->assertSame(0, District::whereNull('lgd_code')->count());

        $this->assertSame([], app(LgdDirectorySync::class)->run(), 'a second run changes nothing');
        $this->assertArrayHasKey('districts_added', $stats);
    }

    public function test_existing_addresses_are_backfilled_and_new_ones_coded_on_save(): void
    {
        $old = Organization::factory()->create();
        DB::table('organizations')->where('id', $old->id)->update(['registered_state' => 'Maharashtra', 'registered_district' => 'Aurangabad']);

        app(LgdDirectorySync::class)->run();

        $old->refresh();
        $this->assertSame('Chhatrapati Sambhajinagar', $old->registered_district);
        $this->assertSame(27, (int) $old->registered_state_lgd_code);
        $this->assertSame(469, (int) $old->registered_district_lgd_code);

        // A form (or an offline mobile cache) still sending the old spelling.
        $new = Organization::factory()->create(['registered_state' => 'Maharashtra', 'registered_district' => 'AURANGABAD']);
        $this->assertSame('Chhatrapati Sambhajinagar', $new->registered_district);
        $this->assertSame(469, (int) $new->registered_district_lgd_code);

        $new->update(['registered_district' => 'Pune']);
        $this->assertSame('Pune', $new->registered_district);
        $this->assertSame(490, (int) $new->registered_district_lgd_code);

        $new->update(['registered_district' => 'Nowhere']);
        $this->assertNull($new->registered_district_lgd_code);
        $this->assertSame(27, (int) $new->registered_state_lgd_code);
    }

    public function test_district_list_hides_districts_no_longer_in_lgd(): void
    {
        app(LgdDirectorySync::class)->run();

        $this->assertFalse(District::where('is_active', true)->where('name', 'SHAHDARA')->exists());
        $this->assertTrue(District::where('is_active', true)->where('name', 'Vav-Tharad')->exists());
    }
}
