<?php

namespace App\Services\Lgd;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Resolves state and district names to Local Government Directory (LGD) codes.
 *
 * Addresses are stored by name (that is what the web and mobile forms send), so the
 * LGD codes are derived from the names on save. District names are matched against
 * the current master first, then against database/data/lgd/district_aliases.csv,
 * which keeps the spellings used before the 2026 LGD refresh (e.g. "Aurangabad" for
 * Chhatrapati Sambhajinagar) resolvable for old drafts and offline mobile caches.
 */
class LgdDirectory
{
    public const CACHE_KEY = 'lgd-directory:v1';

    public const ALIASES_FILE = 'data/lgd/district_aliases.csv';

    /** @var array{states: array<string, int>, districts: array<string, array{code: int, name: string}>}|null */
    private ?array $maps = null;

    public function stateCode(?string $state): ?int
    {
        $key = self::key($state);

        return $key === '' ? null : ($this->maps()['states'][$key] ?? null);
    }

    /**
     * The district's LGD code and current name (display form), or null when the name is unknown.
     *
     * @return array{code: int, name: string}|null
     */
    public function district(?string $state, ?string $district): ?array
    {
        $stateCode = $this->stateCode($state);
        $key = self::key($district);
        if ($stateCode === null || $key === '') {
            return null;
        }

        return $this->maps()['districts'][$stateCode.'|'.$key] ?? null;
    }

    public static function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Display form of a place name, as the masters' accessors return it (and so as the
     * dropdowns show it and the forms send it back). LGD publishes mixed case
     * ("Dr. B.R. Ambedkar Konaseema"), which is kept apart from small joining words;
     * the older all-caps names ("JAMMU AND KASHMIR") are title-cased.
     */
    public static function displayName(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $name = $value === strtoupper($value) ? ucwords(strtolower($value)) : $value;
        foreach (['And', 'Or', 'Of', 'The', 'A', 'An', 'In', 'On', 'At', 'To', 'For', 'With'] as $word) {
            $name = str_replace(' '.$word.' ', ' '.strtolower($word).' ', $name);
        }

        return $name;
    }

    /** Case-, space- and punctuation-insensitive form used for matching names. */
    public static function key(?string $name): string
    {
        $name = strtolower(trim((string) $name));

        return trim(preg_replace('/[^a-z0-9]+/', ' ', $name) ?? $name);
    }

    /**
     * @return array<int, array{state_lgd_code: int, district_lgd_code: int, alias: string}>
     */
    public static function aliases(): array
    {
        $path = database_path(self::ALIASES_FILE);
        if (! is_file($path)) {
            return [];
        }

        $rows = [];
        $handle = fopen($path, 'r');
        fgetcsv($handle);
        while (($row = fgetcsv($handle)) !== false) {
            if (count($row) >= 3 && $row[0] !== '') {
                $rows[] = ['state_lgd_code' => (int) $row[0], 'district_lgd_code' => (int) $row[1], 'alias' => $row[2]];
            }
        }
        fclose($handle);

        return $rows;
    }

    private function maps(): array
    {
        return $this->maps ??= Cache::remember(self::CACHE_KEY, now()->addHours(12), function () {
            $states = [];
            foreach (DB::table('states')->whereNotNull('lgd_code')->get(['name', 'lgd_code']) as $row) {
                $states[self::key($row->name)] = (int) $row->lgd_code;
            }

            $districts = [];
            $byCode = [];
            $rows = DB::table('districts')
                ->join('states', 'states.id', '=', 'districts.state_id')
                ->whereNotNull('districts.lgd_code')
                ->whereNotNull('states.lgd_code')
                ->get(['districts.name', 'districts.lgd_code', 'states.lgd_code as state_lgd_code']);
            foreach ($rows as $row) {
                $entry = ['code' => (int) $row->lgd_code, 'name' => self::displayName($row->name)];
                $byCode[$entry['code']] = $entry;
                $districts[$row->state_lgd_code.'|'.self::key($row->name)] = $entry;
            }

            // Old spellings point at the district's current entry, never over a current name.
            foreach (self::aliases() as $alias) {
                $key = $alias['state_lgd_code'].'|'.self::key($alias['alias']);
                if (! isset($districts[$key]) && isset($byCode[$alias['district_lgd_code']])) {
                    $districts[$key] = $byCode[$alias['district_lgd_code']];
                }
            }

            return ['states' => $states, 'districts' => $districts];
        });
    }
}
