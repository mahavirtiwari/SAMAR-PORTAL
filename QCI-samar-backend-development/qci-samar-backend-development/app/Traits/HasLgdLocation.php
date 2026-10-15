<?php

namespace App\Traits;

use App\Services\Lgd\LgdDirectory;
use App\Services\Lgd\LgdDirectorySync;
use Illuminate\Database\Eloquent\Model;

/**
 * Keeps the LGD code columns of a model's address fields in step with the state and
 * district names the forms send (columns listed in LgdDirectorySync::ADDRESS_COLUMNS).
 * A district sent under a pre-2026 spelling is stored under its current LGD name.
 */
trait HasLgdLocation
{
    public static function bootHasLgdLocation(): void
    {
        static::saving(function (Model $model) {
            $groups = LgdDirectorySync::ADDRESS_COLUMNS[$model->getTable()] ?? [];
            $directory = null;

            foreach ($groups as [$stateCol, $districtCol, $stateCodeCol, $districtCodeCol]) {
                $stale = $model->isDirty([$stateCol, $districtCol])
                    || ($model->getAttribute($stateCol) && $model->getAttribute($stateCodeCol) === null);
                if (! $stale) {
                    continue;
                }

                $directory ??= app(LgdDirectory::class);
                $state = $model->getAttribute($stateCol);
                $district = $model->getAttribute($districtCol);
                $resolved = $directory->district($state, $district);

                $model->setAttribute($stateCodeCol, $directory->stateCode($state));
                $model->setAttribute($districtCodeCol, $resolved['code'] ?? null);
                if ($resolved && LgdDirectory::key($resolved['name']) !== LgdDirectory::key($district)) {
                    $model->setAttribute($districtCol, $resolved['name']);
                }
            }
        });
    }
}
