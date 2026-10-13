<?php

namespace Tests\Feature;

use App\Models\CommitteeMember;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommitteeMemberSearchTest extends TestCase
{
    use RefreshDatabase;

    private function makeMember(string $firstName, string $lastName, string $email): CommitteeMember
    {
        return CommitteeMember::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'mobile_number' => '9999999999',
            'designation' => 'Scientist',
            'organisation' => 'DRDO',
            'status' => 'active',
        ]);
    }

    public function test_full_name_search_matches_the_member(): void
    {
        $this->makeMember('Naman', 'Jain', 'naman@example.com');
        $this->makeMember('Anil', 'Kumar', 'anil@example.com');

        $results = CommitteeMember::search('Naman Jain')->pluck('email');

        $this->assertSame(['naman@example.com'], $results->all());
    }

    public function test_partial_name_and_email_search_still_match(): void
    {
        $this->makeMember('Naman', 'Jain', 'naman@example.com');
        $this->makeMember('Anil', 'Kumar', 'anil@example.com');

        $this->assertSame(['naman@example.com'], CommitteeMember::search('Jain')->pluck('email')->all());
        $this->assertSame(['anil@example.com'], CommitteeMember::search('anil@')->pluck('email')->all());
        $this->assertSame(['naman@example.com'], CommitteeMember::search('  Naman Jain ')->pluck('email')->all());
    }

    public function test_blank_search_returns_everyone(): void
    {
        $this->makeMember('Naman', 'Jain', 'naman@example.com');
        $this->makeMember('Anil', 'Kumar', 'anil@example.com');

        $this->assertSame(2, CommitteeMember::search('   ')->count());
        $this->assertSame(2, CommitteeMember::search(null)->count());
    }
}
