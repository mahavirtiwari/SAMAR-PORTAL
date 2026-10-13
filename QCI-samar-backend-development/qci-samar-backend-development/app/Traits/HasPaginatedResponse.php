<?php

namespace App\Traits;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait HasPaginatedResponse
{
    /**
     * Resolve a safe page size from the request.
     *
     * Every paginated endpoint MUST use this rather than passing request input to
     * paginate() itself. An unbounded value reaches MySQL as the LIMIT clause: a
     * negative one is a syntax error (the 500 behind the STQC "Verbose SQL Error
     * Message" finding), and a huge one is a trivial way to exhaust memory.
     *
     * Non-numeric input falls back to the default instead of casting to 0, since
     * (int) 'abc' is 0 and a zero LIMIT is its own error.
     */
    protected function resolvePerPage(Request $request, int $default = 15, int $max = 100): int
    {
        $requested = $request->input('perPage', $request->input('per_page', $default));

        if (! is_numeric($requested)) {
            return $default;
        }

        return max(1, min((int) $requested, $max));
    }

    /**
     * Returns all records or paginated based on request.
     *
     * Supports two modes:
     * 1. All records mode: ?all=true - Returns all records without pagination (for dropdowns)
     * 2. Paginated mode (default): Returns paginated results with metadata
     *
     * Strict validation: all=true and pagination params are mutually exclusive.
     *
     * @param  Builder|\Illuminate\Database\Query\Builder  $query
     * @param  string|null  $resourceClass  Optional API Resource class for transformation
     * @param  string  $message  Success message
     * @param  int  $defaultPerPage  Default items per page (default: 15)
     * @param  int  $maxAllRecords  Maximum records allowed when using all=true (default: 1000)
     */
    protected function listResponse(
        Request $request,
        $query,
        ?string $resourceClass = null,
        string $message = 'Data retrieved successfully',
        int $defaultPerPage = 15,
        int $maxAllRecords = 1000
    ): JsonResponse {
        // Strict validation: all=true and pagination are mutually exclusive
        if ($request->boolean('all') && ($request->has('page') || $request->has('per_page') || $request->has('perPage'))) {
            return $this->errorResponse(
                'Cannot use "all" parameter with pagination. Use either "all=true" OR "page"/"per_page"/"perPage", not both.',
                400
            );
        }

        // All records mode
        if ($request->boolean('all')) {
            // Safety check: prevent fetching too many records
            $count = $query->toBase()->getCountForPagination();

            if ($count > $maxAllRecords) {
                return $this->errorResponse(
                    "Dataset too large ({$count} records). Maximum allowed without pagination is {$maxAllRecords}. Please use pagination or apply filters.",
                    400
                );
            }

            $data = $query->get();
            $transformedData = $resourceClass
                ? $resourceClass::collection($data)
                : $data;

            return $this->successResponse($transformedData, $message);
        }

        // Paginated mode (default) - support both camelCase and snake_case
        $paginated = $query->paginate($this->resolvePerPage($request, $defaultPerPage));

        return $this->paginatedResponse($paginated, $message, $resourceClass);
    }

    /**
     * Paginated response helper
     *
     * @param  mixed  $data
     * @param  string|null  $resourceClass  Optional API Resource class for transformation
     */
    protected function paginatedResponse($data, string $message = 'Success', ?string $resourceClass = null, array $extra = []): JsonResponse
    {
        $items = $resourceClass
            ? $resourceClass::collection($data->items())
            : $data->items();

        // $extra adds top-level keys beside data and pagination, for a listing that also
        // answers something about the whole filtered set rather than the current page,
        // such as the payment totals. Empty for every existing caller, so the envelope
        // they receive is unchanged.
        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $items,
            'pagination' => $this->getPaginationMeta($data),
            ...$extra,
        ]);
    }

    /**
     * Get pagination metadata
     *
     * @param  mixed  $data
     */
    protected function getPaginationMeta($data): array
    {
        return [
            'currentPage' => $data->currentPage(),
            'perPage' => $data->perPage(),
            'total' => $data->total(),
            'lastPage' => $data->lastPage(),
            'from' => $data->firstItem(),
            'to' => $data->lastItem(),
        ];
    }
}
