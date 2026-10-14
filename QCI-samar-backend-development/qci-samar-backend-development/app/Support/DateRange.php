<?php

namespace App\Support;

use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Carbon;

/**
 * Date-range filters that keep the column indexable. whereDate() wraps the
 * column in DATE(), so MySQL scans the whole table; these compare against the
 * day's boundaries instead. An unparseable value falls back to whereDate().
 */
final class DateRange
{
    /**
     * @template T of Builder
     *
     * @param  T  $query
     * @return T
     */
    public static function from(Builder $query, string $column, mixed $date): Builder
    {
        try {
            return $query->where($column, '>=', Carbon::parse($date)->startOfDay());
        } catch (\Throwable) {
            return $query->whereDate($column, '>=', $date);
        }
    }

    /**
     * @template T of Builder
     *
     * @param  T  $query
     * @return T
     */
    public static function until(Builder $query, string $column, mixed $date): Builder
    {
        try {
            return $query->where($column, '<', Carbon::parse($date)->addDay()->startOfDay());
        } catch (\Throwable) {
            return $query->whereDate($column, '<=', $date);
        }
    }
}
