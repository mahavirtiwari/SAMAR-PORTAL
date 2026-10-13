<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * CaseConverter
 *
 * Utility class for converting array keys between different case formats
 */
class CaseConverter
{
    /**
     * Recursively convert all array keys to camelCase
     */
    public static function toCamelCase(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            // Convert the key to camelCase
            $camelKey = Str::camel($key);

            // Recursively process arrays
            if (is_array($value)) {
                $result[$camelKey] = self::toCamelCase($value);
            } else {
                $result[$camelKey] = $value;
            }
        }

        return $result;
    }

    /**
     * Recursively convert all array keys to snake_case
     */
    public static function toSnakeCase(array $data): array
    {
        $result = [];

        foreach ($data as $key => $value) {
            // Convert the key to snake_case
            $snakeKey = Str::snake($key);

            // Recursively process arrays
            if (is_array($value)) {
                $result[$snakeKey] = self::toSnakeCase($value);
            } else {
                $result[$snakeKey] = $value;
            }
        }

        return $result;
    }
}
