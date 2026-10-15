<?php

namespace Tests\Feature;

use App\Models\Discipline;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

/**
 * Assessment disciplines carry an optional description, set on add and edit.
 */
class DisciplineDescriptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_description_is_saved_returned_and_editable(): void
    {
        $this->seed(RoleSeeder::class);
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::where('slug', Role::SYSTEM_ADMIN)->firstOrFail()->id, ['is_active' => true, 'assigned_at' => now()]);
        $headers = ['Authorization' => 'Bearer '.JWTAuth::fromUser($admin)];

        $created = $this->postJson('/api/v1/disciplines', [
            'name' => 'Supply Chain',
            'description' => 'Vendor development, sourcing and incoming inspection.',
            'sector' => 'manufacturing',
        ], $headers)->assertCreated()->json('data');
        $this->assertSame('Vendor development, sourcing and incoming inspection.', $created['description'] ?? data_get($created, 'discipline.description'));

        $id = $created['id'] ?? data_get($created, 'discipline.id');
        $this->putJson("/api/v1/disciplines/{$id}", ['name' => 'Supply Chain', 'description' => '', 'sector' => 'manufacturing'], $headers)->assertOk();
        $this->assertNull(Discipline::findOrFail($id)->description);

        $this->postJson('/api/v1/disciplines', [
            'name' => 'Too Long',
            'description' => str_repeat('x', 1001),
            'sector' => 'manufacturing',
        ], $headers)->assertStatus(422);
    }
}
