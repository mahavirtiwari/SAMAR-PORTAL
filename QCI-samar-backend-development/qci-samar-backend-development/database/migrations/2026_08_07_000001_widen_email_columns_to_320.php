<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Widens every user-entered email column from the default VARCHAR(255) to 320,
 * the RFC 5321 maximum the validation layer already enforces.
 *
 * The rules said max:320 while the columns were 255, so a 256-320 character
 * address passed validation and then failed at the database.
 *
 * Log/telemetry columns (audit_logs.user_email, error_logs.user_email,
 * notification_events.recipient_email) and payments.customer_email stay at 255:
 * they record values rather than accept them, and are not covered by the 320 rules.
 */
return new class extends Migration
{
    /**
     * Column widths are restated in full because change() rewrites the whole
     * definition — omitting nullable() here would silently make columns NOT NULL.
     */
    private const TARGETS = [
        'users' => [
            ['email', false],
        ],
        'organizations' => [
            ['email', false],
            ['alternate_email', true],
            ['owner_email', true],
        ],
        'units' => [
            ['email', true],
            ['alternate_email', true],
            ['contact_person_email', true],
        ],
        'applications' => [
            ['registered_office_email', true],
            ['registered_office_alternate_email', true],
            ['unit_email', true],
            ['unit_alternate_email', true],
            ['contact_person_email', true],
        ],
        'committee_members' => [
            ['email', false],
        ],
    ];

    public function up(): void
    {
        $this->resize(320);
    }

    public function down(): void
    {
        $this->resize(255);
    }

    private function resize(int $length): void
    {
        foreach (self::TARGETS as $tableName => $columns) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName, $columns, $length) {
                foreach ($columns as [$column, $nullable]) {
                    if (! Schema::hasColumn($tableName, $column)) {
                        continue;
                    }

                    $definition = $table->string($column, $length);

                    if ($nullable) {
                        $definition->nullable();
                    }

                    $definition->change();
                }
            });
        }
    }
};
