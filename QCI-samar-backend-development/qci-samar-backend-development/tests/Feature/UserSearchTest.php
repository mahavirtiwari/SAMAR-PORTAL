<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_full_name_search_matches_the_user(): void
    {
        User::factory()->create(['first_name' => 'Naman', 'last_name' => 'Jain', 'email' => 'naman@example.com']);
        User::factory()->create(['first_name' => 'Anil', 'last_name' => 'Kumar', 'email' => 'anil@example.com']);

        $this->assertSame(['naman@example.com'], User::searchUsers('Naman Jain')->pluck('email')->all());
        $this->assertSame(['naman@example.com'], User::searchUsers(' Jain ')->pluck('email')->all());
        $this->assertSame(['anil@example.com'], User::searchUsers('anil@')->pluck('email')->all());
    }

    public function test_mobile_search_and_blank_search(): void
    {
        User::factory()->create(['first_name' => 'Naman', 'last_name' => 'Jain', 'mobile_number' => '9876501234']);
        User::factory()->create(['first_name' => 'Anil', 'last_name' => 'Kumar', 'mobile_number' => '9123409876']);

        $this->assertSame(1, User::searchUsers('98765')->count());
        $this->assertSame(2, User::searchUsers('  ')->count());
    }

    public function test_samar_id_search_matches_the_user(): void
    {
        User::factory()->create(['samar_id' => 'SAMAR-131026-423', 'email' => 'tony@example.com']);
        User::factory()->create(['samar_id' => 'SAMAR-091026-415', 'email' => 'qa@example.com']);

        $this->assertSame(['tony@example.com'], User::searchUsers('SAMAR-131026-423')->pluck('email')->all());
        $this->assertSame(['tony@example.com'], User::searchUsers('samar-1310')->pluck('email')->all());
    }
}
