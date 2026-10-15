<?php

namespace App\Services\Lgd;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;

/**
 * Brings the state/district masters in line with an LGD (lgdirectory.gov.in) download
 * and refreshes the LGD codes on every table that stores an address by name.
 *
 * - States keep their names and 2-letter codes (application numbers and assessor state
 *   assignments use them); they only gain their LGD code.
 * - Districts take the LGD name and code. New LGD districts are added; districts no
 *   longer in LGD are kept (assessor assignments and old records point at them) but
 *   marked inactive so the dropdowns stop offering them.
 * - Stored district names on applications, organizations, units and pincodes are
 *   rewritten to the current LGD name, and their LGD code columns filled.
 *
 * Idempotent: running it again with the same files changes nothing.
 */
class LgdDirectorySync
{
    /** The LGD download shipped in database/data/lgd/ (files named states.<date>.csv / districts.<date>.csv). */
    public const SNAPSHOT = '14Oct2026';

    /** table => [[state column, district column|null, state code column, district code column|null], ...] */
    public const ADDRESS_COLUMNS = [
        'applications' => [
            ['unit_state', 'unit_district', 'unit_state_lgd_code', 'unit_district_lgd_code'],
            ['registered_office_state', 'registered_office_district', 'registered_office_state_lgd_code', 'registered_office_district_lgd_code'],
        ],
        'organizations' => [
            ['registered_state', 'registered_district', 'registered_state_lgd_code', 'registered_district_lgd_code'],
        ],
        'units' => [
            ['state', 'district', 'state_lgd_code', 'district_lgd_code'],
        ],
        'pincodes' => [
            ['state', 'district', 'state_lgd_code', 'district_lgd_code'],
        ],
    ];

    /** @var array<string, int> */
    private array $stats = [];

    /**
     * @return array<string, int> counts of what changed
     */
    public function run(?string $snapshot = null): array
    {
        $snapshot ??= self::SNAPSHOT;
        $states = $this->readCsv("states.{$snapshot}.csv");
        $districts = $this->readCsv("districts.{$snapshot}.csv");
        $this->stats = [];

        DB::transaction(function () use ($states, $districts) {
            $stateIds = $this->syncStates($states);
            $this->syncDistricts($districts, $stateIds);
        });
        LgdDirectory::flush();

        foreach (self::ADDRESS_COLUMNS as $table => $groups) {
            foreach ($groups as $group) {
                $this->backfill($table, ...$group);
            }
        }
        LgdDirectory::flush();

        Log::info('LGD directory synced', ['snapshot' => $snapshot] + $this->stats);

        return $this->stats;
    }

    /**
     * @param  array<int, array<string, string>>  $rows
     * @return array<int, int> state LGD code => states.id
     */
    private function syncStates(array $rows): array
    {
        $existing = DB::table('states')->get(['id', 'name', 'lgd_code']);
        $byCode = $existing->whereNotNull('lgd_code')->keyBy('lgd_code');
        $byName = $existing->keyBy(fn ($s) => LgdDirectory::key($s->name));
        $countryId = DB::table('countries')->whereRaw('LOWER(name) = ?', ['india'])->value('id') ?? 101;

        $ids = [];
        foreach ($rows as $row) {
            $code = (int) $row['State Code'];
            $name = trim($row['State Name (In English)']);
            $match = $byCode->get($code) ?? $byName->get(LgdDirectory::key($name));

            if ($match) {
                if ((int) $match->lgd_code !== $code) {
                    DB::table('states')->where('id', $match->id)->update(['lgd_code' => $code, 'updated_at' => now()]);
                    $this->count('states_coded');
                }
                $ids[$code] = $match->id;
            } else {
                $ids[$code] = DB::table('states')->insertGetId([
                    'country_id' => $countryId,
                    'name' => strtoupper($name),
                    'lgd_code' => $code,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $this->count('states_added');
            }
        }

        return $ids;
    }

    /**
     * @param  array<int, array<string, string>>  $rows
     * @param  array<int, int>  $stateIds
     */
    private function syncDistricts(array $rows, array $stateIds): void
    {
        $existing = DB::table('districts')->get(['id', 'state_id', 'name', 'lgd_code', 'is_active']);
        $byCode = $existing->whereNotNull('lgd_code')->keyBy('lgd_code');
        $byName = $existing->keyBy(fn ($d) => $d->state_id.'|'.LgdDirectory::key($d->name));

        $stateIdByCode = $stateIds;
        $aliasCodes = [];
        foreach (LgdDirectory::aliases() as $alias) {
            if (isset($stateIdByCode[$alias['state_lgd_code']])) {
                $aliasCodes[$stateIdByCode[$alias['state_lgd_code']].'|'.LgdDirectory::key($alias['alias'])] = $alias['district_lgd_code'];
            }
        }

        // Rows still carrying an old spelling, looked up by the LGD code that spelling stands for.
        $byAliasCode = [];
        foreach ($existing as $district) {
            $code = $aliasCodes[$district->state_id.'|'.LgdDirectory::key($district->name)] ?? null;
            if ($code !== null && $district->lgd_code === null) {
                $byAliasCode[$code] = $district;
            }
        }

        $seen = [];
        foreach ($rows as $row) {
            $code = (int) $row['District Code'];
            $name = trim($row['District Name(In English)']);
            $stateId = $stateIds[(int) $row['State Code']] ?? null;
            if ($stateId === null) {
                continue;
            }

            $match = $byCode->get($code) ?? $byName->get($stateId.'|'.LgdDirectory::key($name)) ?? ($byAliasCode[$code] ?? null);

            if ($match) {
                $changes = [];
                if ($match->name !== $name) {
                    $changes['name'] = $name;
                    $this->count('districts_renamed');
                }
                if ((int) $match->lgd_code !== $code) {
                    $changes['lgd_code'] = $code;
                    $this->count('districts_coded');
                }
                if ((int) $match->state_id !== $stateId) {
                    $changes['state_id'] = $stateId;
                }
                if (! $match->is_active) {
                    $changes['is_active'] = true;
                }
                if ($changes) {
                    DB::table('districts')->where('id', $match->id)->update($changes + ['updated_at' => now()]);
                }
                $seen[$match->id] = true;
            } else {
                $seen[DB::table('districts')->insertGetId([
                    'state_id' => $stateId,
                    'name' => $name,
                    'lgd_code' => $code,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])] = true;
                $this->count('districts_added');
            }
        }

        // No longer in LGD: keep the row (assessor assignments reference it) but stop offering it.
        foreach ($existing as $district) {
            if (isset($seen[$district->id])) {
                continue;
            }
            $changes = [];
            if ($district->is_active) {
                $changes['is_active'] = false;
                $this->count('districts_deactivated');
            }
            $oldCode = $aliasCodes[$district->state_id.'|'.LgdDirectory::key($district->name)] ?? null;
            if ($district->lgd_code === null && $oldCode !== null && ! $byCode->has($oldCode)) {
                $changes['lgd_code'] = $oldCode;
            }
            if ($changes) {
                DB::table('districts')->where('id', $district->id)->update($changes + ['updated_at' => now()]);
            }
        }
    }

    /**
     * Fills the LGD code columns from the stored names and rewrites district names to
     * the current LGD spelling, one UPDATE per distinct (state, district) pair.
     */
    private function backfill(string $table, string $stateCol, ?string $districtCol, string $stateCodeCol, ?string $districtCodeCol): void
    {
        $directory = new LgdDirectory;
        $columns = array_filter([$stateCol, $districtCol]);

        $pairs = DB::table($table)->whereNotNull($stateCol)->where($stateCol, '!=', '')->distinct()->get($columns);
        foreach ($pairs as $pair) {
            $state = $pair->{$stateCol};
            $district = $districtCol ? $pair->{$districtCol} : null;
            $stateCode = $directory->stateCode($state);
            $resolved = $districtCol ? $directory->district($state, $district) : null;

            $changes = [$stateCodeCol => $stateCode];
            if ($districtCodeCol) {
                $changes[$districtCodeCol] = $resolved['code'] ?? null;
            }
            if ($resolved && $resolved['name'] !== $district) {
                $changes[$districtCol] = $resolved['name'];
            }

            $query = DB::table($table)->where($stateCol, $state);
            $districtCol && ($district === null ? $query->whereNull($districtCol) : $query->where($districtCol, $district));
            $updated = $query->update($changes);

            $this->count("{$table}_rows", $updated);
            if ($districtCol && $district !== null && $district !== '' && $resolved === null) {
                $this->count("{$table}_unmatched_districts");
            }
        }
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function readCsv(string $file): array
    {
        $path = database_path('data/lgd/'.$file);
        if (! is_file($path)) {
            throw new RuntimeException("LGD file not found: database/data/lgd/{$file}");
        }

        $handle = fopen($path, 'r');
        $header = array_map(fn ($h) => trim(preg_replace('/^\xEF\xBB\xBF/', '', $h)), fgetcsv($handle));
        $rows = [];
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) === count($header)) {
                $rows[] = array_combine($header, $row);
            }
        }
        fclose($handle);

        if ($rows === []) {
            throw new RuntimeException("LGD file is empty: database/data/lgd/{$file}");
        }

        return $rows;
    }

    private function count(string $key, int $by = 1): void
    {
        if ($by === 0) {
            return;
        }
        $this->stats[$key] = ($this->stats[$key] ?? 0) + $by;
    }
}
