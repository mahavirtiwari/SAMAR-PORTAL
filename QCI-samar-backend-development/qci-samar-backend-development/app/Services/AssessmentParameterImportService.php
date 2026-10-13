<?php

namespace App\Services;

use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\AssessmentQuestionOption;
use App\Models\Discipline;
use App\Rules\EntityName;
use App\Support\Csv;
use App\Support\TextNormalizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\Exception as ReaderException;

class AssessmentParameterImportService
{
    /**
     * Expected total weightage for each parameter.
     */
    protected const EXPECTED_WEIGHTAGE_TOTAL = 100;

    /**
     * Maximum length of a question or option text.
     *
     * This is the width of the columns that store it (assessment_questions.question_text,
     * assessment_question_options.option_text, and the per-application snapshot copies of
     * both), not an arbitrary cap. Keep it equal to the narrowest of those columns: when it
     * was wider, a longer imported value was truncated by the database on the way in, and
     * a question over the column width could never afterwards be edited through the UI,
     * whose validation refuses to submit it.
     */
    protected const MAX_TEXT_LENGTH = 1000;

    /**
     * Expected Excel columns.
     */
    protected array $expectedColumns = [
        'discipline',
        'parameter name',
        'parameter type',
        'question category',
        'question text',
        'weightage (%)',
        'option 1 text',
        'option 2 text',
        'option 3 text',
        'option 4 text',
        'option 5 text',
    ];

    /**
     * Valid question categories.
     */
    protected array $validCategories = ['planning', 'deployment', 'monitoring'];

    /**
     * Import assessment parameters from uploaded file.
     */
    public function import(
        UploadedFile $file,
        string $sector,
        array $enterpriseSizes,
        ?string $serviceProviderType,
        array $vendorCategoryIds
    ): array {
        $errors = [];

        try {
            // Load spreadsheet
            $spreadsheet = IOFactory::load($file->getRealPath());
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            // Remove BOM if present
            if (isset($rows[0][0]) && substr($rows[0][0], 0, 3) === "\xEF\xBB\xBF") {
                $rows[0][0] = substr($rows[0][0], 3);
            }

            // Validate file has data
            if (empty($rows) || count($rows) < 2) {
                return [
                    'success' => false,
                    'message' => 'Import failed with validation errors',
                    'data' => [
                        'errors' => [
                            ['row' => 0, 'errors' => ['File is empty or does not contain data rows']],
                        ],
                    ],
                ];
            }

            // Validate headers
            $headers = array_map(fn ($h) => strtolower(trim($h)), $rows[0]);
            $headerValidation = $this->validateHeaders($headers);

            if (! $headerValidation['valid']) {
                return [
                    'success' => false,
                    'message' => 'Import failed with validation errors',
                    'data' => [
                        'errors' => [
                            ['row' => 1, 'errors' => $headerValidation['errors']],
                        ],
                    ],
                ];
            }

            // Process data rows
            $dataRows = array_slice($rows, 1);

            // Parse and group rows by parameter code
            $groupedData = $this->parseAndGroupRows($dataRows, $headers);

            if (isset($groupedData['errors']) && ! empty($groupedData['errors'])) {
                return [
                    'success' => false,
                    'message' => 'Import failed with validation errors',
                    'data' => [
                        'errors' => $groupedData['errors'],
                    ],
                ];
            }

            $parameters = $groupedData['parameters'];

            // Validate weightage sums for each parameter
            $weightageValidation = $this->validateWeightages($parameters);
            if (! empty($weightageValidation)) {
                return [
                    'success' => false,
                    'message' => 'Import failed with validation errors',
                    'data' => [
                        'errors' => $weightageValidation,
                    ],
                ];
            }

            // Begin transaction - all or nothing
            DB::beginTransaction();

            try {
                $stats = [
                    'disciplines' => ['created' => 0, 'existing' => 0],
                    'parameters' => ['created' => 0, 'updated' => 0, 'inactive' => []],
                    'questions' => ['created' => 0, 'removed' => 0],
                    'options' => ['created' => 0],
                ];

                $userId = Auth::id();

                // Upsert disciplines once — they are global (keyed by name), independent of the
                // size/category cells this import fans out into.
                $disciplines = $this->resolveDisciplines($parameters, $userId, $stats);

                // Fan out: persist the parsed parameters into every (enterprise_size ×
                // vendor_category) cell. The file is parsed and validated once above; only
                // persistence multiplies. Each newly-created parameter row gets its own
                // MFG-/SVC- code.
                foreach ($enterpriseSizes as $enterpriseSize) {
                    foreach ($vendorCategoryIds as $vendorCategoryId) {
                        $this->persistCombo(
                            $parameters,
                            $disciplines,
                            $sector,
                            $enterpriseSize,
                            $serviceProviderType,
                            (int) $vendorCategoryId,
                            $userId,
                            $stats
                        );
                    }
                }

                DB::commit();

                // Log audit trail
                Log::info('Assessment parameters bulk import completed', [
                    'user_id' => $userId,
                    'file_name' => $file->getClientOriginalName(),
                    'sector' => $sector,
                    'enterprise_sizes' => $enterpriseSizes,
                    'service_provider_type' => $serviceProviderType,
                    'vendor_category_ids' => $vendorCategoryIds,
                    'stats' => $stats,
                ]);

                return [
                    'success' => true,
                    'message' => 'Import completed successfully',
                    'data' => $stats,
                ];

            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Assessment parameter import transaction failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return [
                    'success' => false,
                    'message' => 'Import failed with database error',
                    'data' => [
                        'errors' => [
                            ['row' => 0, 'errors' => ['Database error: '.$e->getMessage()]],
                        ],
                    ],
                ];
            }

        } catch (ReaderException $e) {
            Log::error('Failed to read import file', ['error' => $e->getMessage()]);

            return [
                'success' => false,
                'message' => 'Import failed with file read error',
                'data' => [
                    'errors' => [
                        ['row' => 0, 'errors' => ['Failed to read file: '.$e->getMessage()]],
                    ],
                ],
            ];
        } catch (\Exception $e) {
            Log::error('Assessment parameter import failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return [
                'success' => false,
                'message' => 'Import failed',
                'data' => [
                    'errors' => [
                        ['row' => 0, 'errors' => ['Import failed: '.$e->getMessage()]],
                    ],
                ],
            ];
        }
    }

    /**
     * Upsert the parsed parameters (with their questions + options) into a single
     * (enterprise_size × vendor_category) cell. Existing rows in this cell differ only by
     * name, so a single whereIn pre-loads them; questions/options are bulk-refreshed.
     * Newly-created parameter rows get their own MFG-/SVC- code.
     *
     * @param  array  $parameters  parsed parameter → {discipline, is_mandatory, questions} map
     * @param  Collection  $disciplines  name → Discipline model
     * @param  array  $stats  mutated in place
     */
    protected function persistCombo(
        array $parameters,
        $disciplines,
        string $sector,
        string $enterpriseSize,
        ?string $serviceProviderType,
        int $vendorCategoryId,
        ?int $userId,
        array &$stats
    ): void {
        $existingParameters = AssessmentParameter::withTrashed()
            ->whereIn('name', array_keys($parameters))
            ->where('sector', $sector)
            ->where('enterprise_size', $enterpriseSize)
            ->where('vendor_category_id', $vendorCategoryId)
            ->where(function ($q) use ($serviceProviderType) {
                if ($serviceProviderType === null) {
                    $q->whereNull('service_provider_type');
                } else {
                    $q->where('service_provider_type', $serviceProviderType);
                }
            })
            ->get()
            ->keyBy('name');

        // Pass 1: upsert parameters for this cell. Every parameter is written INACTIVE here
        // and activated in pass 3 only once its rebuilt questions total 100%. Import used to
        // write is_active = true up front, which was the one path that could put a parameter
        // into service without the 100% check the manual activate endpoint enforces; the
        // 21-Aug duplicate import left 17 active parameters at 50-90% that way, and every
        // assessment built from them scored below scale. Inactive-first also keeps the
        // question observer quiet while the set is mid-rebuild.
        $parameterModels = [];

        foreach ($parameters as $parameterName => $parameterData) {
            $discipline = $disciplines->get(TextNormalizer::normalizeKey($parameterData['discipline']));
            $parameter = $existingParameters->get($parameterName);

            $parameterFields = [
                'name' => $parameterName,
                'discipline_id' => $discipline->id,
                'vendor_category_id' => $vendorCategoryId,
                'sector' => $sector,
                'enterprise_size' => $enterpriseSize,
                'service_provider_type' => $serviceProviderType,
                'is_mandatory' => $parameterData['is_mandatory'],
                'is_active' => false,
                'updated_by' => $userId,
            ];

            if ($parameter) {
                if ($parameter->trashed()) {
                    $parameter->restore();
                }
                $parameter->update($parameterFields);
                $stats['parameters']['updated']++;
            } else {
                $parameterFields['created_by'] = $userId;
                $parameterFields['code'] = AssessmentParameter::generateCode($sector);
                $parameter = AssessmentParameter::create($parameterFields);
                $stats['parameters']['created']++;
            }

            $parameterModels[$parameterName] = $parameter;
        }

        // Pass 2: the file is the complete question set for every parameter it names, so each
        // parameter's existing questions are discarded and rebuilt from the file.
        //
        // This used to match existing questions by their TEXT. Editing a single word in a
        // sheet and re-importing therefore produced a SECOND question rather than replacing
        // the first, and nothing removed questions the file no longer contained — so a
        // parameter built from two 100% sheets ended up at 200%. That total is not cosmetic:
        // the parameter score is sum(selected_score × weightage/100), so a 200% parameter
        // scores up to 10.00 on a 0-5 scale and inflates the certification level.
        //
        // Replacing is safe for assessments already under way: an assessment copies the
        // questionnaire into its own application_assessment_* tables when it is created, and
        // those snapshot rows carry no foreign key back to these masters.
        $parameterIds = array_map(fn ($p) => $p->id, $parameterModels);

        $supersededQuestionIds = AssessmentQuestion::withTrashed()
            ->whereIn('parameter_id', $parameterIds)
            ->pluck('id');

        if ($supersededQuestionIds->isNotEmpty()) {
            // Record the removal BEFORE it happens, and explicitly. These are mass
            // deletes on the query builder, which fire no model events, so the audit
            // trait on AssessmentQuestion never sees them. Without this a re-import can
            // permanently remove a parameter's whole question set and leave nothing
            // saying who did it or when — which is exactly what happened on 21-Aug-2026
            // and left BUG-08963 to be diagnosed from gaps in the question numbering.
            //
            // One entry per parameter rather than one per question: a questionnaire
            // import replaces hundreds of questions at a time, and a row each would bury
            // the fact that matters, which is that this parameter's set was replaced.
            foreach ($parameterModels as $parameter) {
                $removed = AssessmentQuestion::withTrashed()
                    ->where('parameter_id', $parameter->id)
                    ->get(['id', 'code', 'question_text', 'weightage']);

                if ($removed->isEmpty()) {
                    continue;
                }

                $parameter->logAudit(
                    'questions_replaced_by_import',
                    ['questions' => $removed->toArray()],
                    null,
                    null,
                    'Questionnaire import replaced this parameter\'s questions.',
                    ['removed_count' => $removed->count()],
                );
            }

            // forceDelete on both: these models use SoftDeletes, and a plain delete() would
            // leave trashed rows that accumulate on every re-import and still count towards
            // withTrashed() lookups.
            AssessmentQuestionOption::whereIn('question_id', $supersededQuestionIds)->forceDelete();
            AssessmentQuestion::whereIn('id', $supersededQuestionIds)->forceDelete();
            $stats['questions']['removed'] += $supersededQuestionIds->count();
        }

        $optionRows = [];
        $now = now();

        foreach ($parameters as $parameterName => $parameterData) {
            $parameter = $parameterModels[$parameterName];

            // The whole set was just removed above, so numbering restarts at Q01.
            $codes = AssessmentQuestion::generateCodes($parameter, count($parameterData['questions']));
            $codeIndex = 0;

            foreach ($parameterData['questions'] as $questionText => $questionData) {
                $question = AssessmentQuestion::create([
                    'code' => $codes[$codeIndex++],
                    'parameter_id' => $parameter->id,
                    'question_text' => $questionText,
                    'category' => $questionData['category'],
                    'weightage' => $questionData['weightage'],
                    'is_active' => true,
                    'created_by' => $userId,
                    'updated_by' => $userId,
                ]);
                $stats['questions']['created']++;

                // Scores 1-5, in option order.
                foreach ($questionData['options'] as $index => $optionText) {
                    $optionRows[] = [
                        'question_id' => $question->id,
                        'option_text' => $optionText,
                        'score' => $index + 1,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                    $stats['options']['created']++;
                }
            }
        }

        foreach (array_chunk($optionRows, 1000) as $optionChunk) {
            AssessmentQuestionOption::insert($optionChunk);
        }

        // Pass 3: activate from what is actually in the database, not from the parsed file.
        foreach ($parameterModels as $parameter) {
            $this->activateIfWeightageTotals100($parameter, $stats);
        }
    }

    /**
     * Put a parameter into service only when its stored active questions total exactly
     * 100%, the same rule the manual activate endpoint enforces. Anything else is left
     * inactive and named in the import summary so the importer sees it immediately.
     *
     * The sheet was already validated to 100% per parameter, so this only differs from
     * the file when persistence itself went wrong, which is exactly the case that must
     * never reach an assessment.
     *
     * @param  array  $stats  mutated in place
     */
    protected function activateIfWeightageTotals100(AssessmentParameter $parameter, array &$stats): void
    {
        $total = $parameter->getActiveQuestionsWeightage();

        if ($total === self::EXPECTED_WEIGHTAGE_TOTAL) {
            $parameter->update(['is_active' => true]);

            return;
        }

        $stats['parameters']['inactive'][] = "{$parameter->code} ({$total}%)";

        Log::warning('Imported parameter left inactive: active questions weightage is not 100%', [
            'parameter_id' => $parameter->id,
            'code' => $parameter->code,
            'active_weightage' => $total,
        ]);
    }

    /**
     * Bulk-update existing assessment parameters from an uploaded file keyed by Parameter ID
     * (the `code` column). Full-replace per parameter: parameter-level fields + the entire
     * question/option set are replaced from the file. Identity (sector / enterprise_size /
     * vendor_category) is immutable and never changed. Only the Parameter IDs present in the
     * file are touched; everything is all-or-nothing.
     *
     * @param  string  $sector  the screen's sector — codes from the other sector are rejected
     */
    public function bulkUpdate(UploadedFile $file, string $sector): array
    {
        // The workbook is parsed and the parameter/question/option rows rewritten
        // synchronously in one all-or-nothing transaction; a larger file must not be
        // aborted mid-transaction by PHP's default max_execution_time.
        set_time_limit(0);

        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
            $rows = $spreadsheet->getActiveSheet()->toArray();

            if (isset($rows[0][0]) && substr($rows[0][0], 0, 3) === "\xEF\xBB\xBF") {
                $rows[0][0] = substr($rows[0][0], 3);
            }

            if (empty($rows) || count($rows) < 2) {
                return $this->errorResult(0, ['File is empty or does not contain data rows'], 'Bulk update failed with validation errors');
            }

            $headers = array_map(fn ($h) => strtolower(trim($h)), $rows[0]);

            // Bulk Update requires the Parameter ID column on top of the standard layout.
            $headerValidation = $this->validateHeaders($headers, array_merge(['parameter id', 'question id'], $this->expectedColumns));
            if (! $headerValidation['valid']) {
                return $this->errorResult(1, $headerValidation['errors'], 'Bulk update failed with validation errors');
            }

            $grouped = $this->parseAndGroupRowsByCode(array_slice($rows, 1), $headers);
            if (! empty($grouped['errors'])) {
                return ['success' => false, 'message' => 'Bulk update failed with validation errors', 'data' => ['errors' => $grouped['errors']]];
            }
            $parameters = $grouped['parameters']; // keyed by code

            // Weightage must still sum to 100% per parameter after the edit.
            $weightageErrors = $this->validateWeightages($parameters);
            if (! empty($weightageErrors)) {
                return ['success' => false, 'message' => 'Bulk update failed with validation errors', 'data' => ['errors' => $weightageErrors]];
            }

            // Resolve and validate every Parameter ID BEFORE mutating (all-or-nothing).
            $codes = array_keys($parameters);
            $existing = AssessmentParameter::withTrashed()->whereIn('code', $codes)->get()->keyBy('code');

            $errors = [];
            foreach ($parameters as $code => $data) {
                $param = $existing->get($code);
                if (! $param) {
                    $errors[] = ['row' => $data['first_row'], 'parameter_id' => $code, 'errors' => ["Unknown Parameter ID '{$code}'"]];
                } elseif ($param->trashed()) {
                    $errors[] = ['row' => $data['first_row'], 'parameter_id' => $code, 'errors' => ["Parameter ID '{$code}' has been deleted and cannot be updated"]];
                } elseif ($param->sector !== $sector) {
                    $errors[] = ['row' => $data['first_row'], 'parameter_id' => $code, 'errors' => ["Parameter ID '{$code}' belongs to the {$param->sector} sector, not {$sector}"]];
                }
            }
            if (! empty($errors)) {
                return ['success' => false, 'message' => 'Bulk update failed with validation errors', 'data' => ['errors' => $errors]];
            }

            // Every Question ID in the file must exist and belong to the Parameter ID on its
            // own row. Without this a mistyped Question ID would silently move a question to
            // a different parameter, or hit a null further down.
            $errors = $this->validateQuestionCodes($parameters, $existing);
            if (! empty($errors)) {
                return ['success' => false, 'message' => 'Bulk update failed with validation errors', 'data' => ['errors' => $errors]];
            }

            DB::beginTransaction();

            try {
                $stats = [
                    'parameters' => ['updated' => 0, 'inactive' => []],
                    'questions' => ['updated' => 0, 'created' => 0, 'removed' => 0],
                    'options' => ['created' => 0],
                ];
                $userId = Auth::id();

                // Upsert disciplines referenced in the file (by name).
                $disciplines = $this->resolveDisciplines($parameters, $userId, $stats);

                $now = now();
                $allOptionRows = [];

                foreach ($parameters as $code => $data) {
                    $param = $existing->get($code);

                    // Parameter-level update — identity columns are intentionally omitted.
                    // Taken out of service for the rebuild; re-activated below from the
                    // stored total (see persistCombo).
                    $param->update([
                        'name' => $data['parameter_name'],
                        'discipline_id' => $disciplines->get(TextNormalizer::normalizeKey($data['discipline']))->id,
                        'is_mandatory' => $data['is_mandatory'],
                        'is_active' => false,
                        'updated_by' => $userId,
                    ]);
                    $stats['parameters']['updated']++;

                    // Match questions by their Question ID, so editing a question's wording
                    // updates that row rather than replacing the whole set. A row with no
                    // Question ID is a new question; a question whose ID the file no longer
                    // carries is removed, which is what keeps the weightage total at 100%.
                    $existingQuestions = AssessmentQuestion::withTrashed()
                        ->where('parameter_id', $param->id)
                        ->get()
                        ->keyBy('code');

                    $keptQuestionIds = [];
                    $newQuestionKeys = [];

                    foreach ($data['questions'] as $questionKey => $questionData) {
                        if ($questionData['question_code'] === null) {
                            $newQuestionKeys[] = $questionKey;

                            continue;
                        }

                        $question = $existingQuestions->get($questionData['question_code']);

                        if ($question->trashed()) {
                            $question->restore();
                        }

                        $question->update([
                            'question_text' => $questionData['question_text'],
                            'category' => $questionData['category'],
                            'weightage' => $questionData['weightage'],
                            'is_active' => true,
                            'updated_by' => $userId,
                        ]);
                        $stats['questions']['updated']++;

                        $keptQuestionIds[] = $question->id;
                        $this->stageOptionRows($allOptionRows, $question->id, $questionData['options'], $now, $stats);
                    }

                    $newCodes = AssessmentQuestion::generateCodes($param, count($newQuestionKeys));

                    foreach ($newQuestionKeys as $position => $questionKey) {
                        $questionData = $data['questions'][$questionKey];

                        $question = AssessmentQuestion::create([
                            'code' => $newCodes[$position],
                            'parameter_id' => $param->id,
                            'question_text' => $questionData['question_text'],
                            'category' => $questionData['category'],
                            'weightage' => $questionData['weightage'],
                            'is_active' => true,
                            'created_by' => $userId,
                            'updated_by' => $userId,
                        ]);
                        $stats['questions']['created']++;

                        $keptQuestionIds[] = $question->id;
                        $this->stageOptionRows($allOptionRows, $question->id, $questionData['options'], $now, $stats);
                    }

                    // Options are rewritten for every question the file describes, so the old
                    // rows go first. Questions the file dropped are removed outright.
                    AssessmentQuestionOption::whereIn('question_id', $keptQuestionIds)->forceDelete();

                    $droppedQuestionIds = $existingQuestions
                        ->reject(fn ($question) => in_array($question->id, $keptQuestionIds, true))
                        ->pluck('id');

                    if ($droppedQuestionIds->isNotEmpty()) {
                        AssessmentQuestionOption::whereIn('question_id', $droppedQuestionIds)->forceDelete();
                        AssessmentQuestion::whereIn('id', $droppedQuestionIds)->forceDelete();
                        $stats['questions']['removed'] += $droppedQuestionIds->count();
                    }
                }

                // Batch every option insert into a few round-trips rather than one per question.
                foreach (array_chunk($allOptionRows, 1000) as $optionChunk) {
                    AssessmentQuestionOption::insert($optionChunk);
                }

                foreach ($parameters as $code => $data) {
                    $this->activateIfWeightageTotals100($existing->get($code), $stats);
                }

                DB::commit();

                Log::info('Assessment parameters bulk update completed', [
                    'user_id' => $userId,
                    'file_name' => $file->getClientOriginalName(),
                    'sector' => $sector,
                    'codes' => $codes,
                    'stats' => $stats,
                ]);

                return [
                    'success' => true,
                    'message' => 'Bulk update completed successfully',
                    'data' => $stats,
                ];
            } catch (\Exception $e) {
                DB::rollBack();
                Log::error('Assessment parameter bulk update transaction failed', [
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);

                return $this->errorResult(0, ['Database error: '.$e->getMessage()], 'Bulk update failed with database error');
            }
        } catch (ReaderException $e) {
            Log::error('Failed to read bulk update file', ['error' => $e->getMessage()]);

            return $this->errorResult(0, ['Failed to read file: '.$e->getMessage()], 'Bulk update failed with file read error');
        } catch (\Exception $e) {
            Log::error('Assessment parameter bulk update failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->errorResult(0, ['Bulk update failed: '.$e->getMessage()], 'Bulk update failed');
        }
    }

    /**
     * Parse rows and group by Parameter ID (`code`) for bulk update. Reuses the per-row field
     * validation; additionally requires a Parameter ID and enforces consistent parameter-level
     * values across rows sharing the same code.
     */
    protected function parseAndGroupRowsByCode(array $dataRows, array $headers): array
    {
        $parameters = [];
        $errors = [];

        $headerIndex = [];
        foreach ($headers as $idx => $name) {
            $headerIndex[$name] = $idx;
        }

        foreach ($dataRows as $index => $row) {
            $rowNumber = $index + 2;

            if (empty(array_filter($row, fn ($v) => $v !== null && $v !== ''))) {
                continue;
            }

            $rowData = [];
            foreach ($headerIndex as $name => $idx) {
                $rowData[$name] = $row[$idx] ?? null;
            }

            $code = isset($rowData['parameter id']) ? trim((string) $rowData['parameter id']) : '';
            if ($code === '') {
                $errors[] = ['row' => $rowNumber, 'errors' => ['Parameter ID is required']];

                continue;
            }

            $validation = $this->validateAndParseRow($rowData, $rowNumber);
            if (! $validation['valid']) {
                foreach ($validation['errors'] as $error) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'parameter_id' => $code,
                        'question_text' => substr((string) ($rowData['question text'] ?? 'N/A'), 0, 50),
                        'errors' => [$error],
                    ];
                }

                continue;
            }

            $parsed = $validation['data'];
            $questionText = $parsed['question_text'];

            if (! isset($parameters[$code])) {
                $parameters[$code] = [
                    'discipline' => $parsed['discipline'],
                    'parameter_name' => $parsed['parameter_name'],
                    'is_mandatory' => $parsed['is_mandatory'],
                    'first_row' => $rowNumber,
                    'questions' => [],
                ];
            } else {
                if ($parameters[$code]['parameter_name'] !== $parsed['parameter_name']) {
                    $errors[] = ['row' => $rowNumber, 'parameter_id' => $code, 'errors' => ["Parameter Name '{$parsed['parameter_name']}' does not match '{$parameters[$code]['parameter_name']}' set on row {$parameters[$code]['first_row']} for the same Parameter ID"]];

                    continue;
                }
                if ($parameters[$code]['discipline'] !== $parsed['discipline']) {
                    $errors[] = ['row' => $rowNumber, 'parameter_id' => $code, 'errors' => ["Discipline does not match the value set on row {$parameters[$code]['first_row']} for the same Parameter ID"]];

                    continue;
                }
                if ($parameters[$code]['is_mandatory'] !== $parsed['is_mandatory']) {
                    $errors[] = ['row' => $rowNumber, 'parameter_id' => $code, 'errors' => ["Parameter Type does not match the value set on row {$parameters[$code]['first_row']} for the same Parameter ID"]];

                    continue;
                }
            }

            // Questions are identified by their Question ID, not their text, so editing the
            // wording of a question updates it in place instead of creating a second one.
            // A blank Question ID means "this is a new question" — the row is added.
            $questionCode = TextNormalizer::normalize($rowData['question id'] ?? null);
            $questionKey = $questionCode !== '' ? $questionCode : 'new#'.$rowNumber;

            if (isset($parameters[$code]['questions'][$questionKey])) {
                $errors[] = ['row' => $rowNumber, 'parameter_id' => $code, 'question_id' => $questionCode, 'errors' => ["Question ID '{$questionCode}' appears more than once (previously on row {$parameters[$code]['questions'][$questionKey]['row']}) — each question may appear only once"]];

                continue;
            }

            foreach ($parameters[$code]['questions'] as $seen) {
                if (TextNormalizer::normalizeKey($seen['question_text']) === TextNormalizer::normalizeKey($questionText)) {
                    $errors[] = ['row' => $rowNumber, 'parameter_id' => $code, 'question_text' => mb_substr($questionText, 0, 50), 'errors' => ["Duplicate question text within Parameter ID '{$code}' (previously seen on row {$seen['row']})"]];

                    continue 2;
                }
            }

            $parameters[$code]['questions'][$questionKey] = [
                'question_code' => $questionCode !== '' ? $questionCode : null,
                'question_text' => $questionText,
                'category' => $parsed['category'],
                'weightage' => $parsed['weightage'],
                'options' => $parsed['options'],
                'row' => $rowNumber,
            ];
        }

        if (! empty($errors)) {
            return ['errors' => $errors];
        }

        return ['parameters' => $parameters];
    }

    /**
     * Build a single-error failure result in the standard import/update response shape.
     */
    protected function errorResult(int $row, array $errors, string $message): array
    {
        return [
            'success' => false,
            'message' => $message,
            'data' => ['errors' => [['row' => $row, 'errors' => $errors]]],
        ];
    }

    /**
     * Validate headers match the expected columns (defaults to the import layout).
     */
    protected function validateHeaders(array $headers, ?array $expectedColumns = null): array
    {
        $missingColumns = [];

        foreach ($expectedColumns ?? $this->expectedColumns as $expectedColumn) {
            if (! in_array($expectedColumn, $headers)) {
                $missingColumns[] = $expectedColumn;
            }
        }

        if (! empty($missingColumns)) {
            return [
                'valid' => false,
                'errors' => [
                    'Missing required columns: '.implode(', ', $missingColumns),
                ],
            ];
        }

        return ['valid' => true, 'errors' => []];
    }

    /**
     * Parse rows and group by parameter code.
     */
    protected function parseAndGroupRows(array $dataRows, array $headers): array
    {
        $parameters = [];
        $errors = [];

        // Build header → column-index map so column order in the file doesn't matter.
        $headerIndex = [];
        foreach ($headers as $idx => $name) {
            $headerIndex[$name] = $idx;
        }

        foreach ($dataRows as $index => $row) {
            $rowNumber = $index + 2; // +2 for header row and 0-index

            // Skip empty rows
            if (empty(array_filter($row, fn ($v) => $v !== null && $v !== ''))) {
                continue;
            }

            // Map by header name, not positional pairing
            $rowData = [];
            foreach ($headerIndex as $name => $idx) {
                $rowData[$name] = $row[$idx] ?? null;
            }

            // Validate and parse row
            $validation = $this->validateAndParseRow($rowData, $rowNumber);

            if (! $validation['valid']) {
                foreach ($validation['errors'] as $error) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'parameter_name' => $rowData['parameter name'] ?? 'N/A',
                        'question_text' => substr((string) ($rowData['question text'] ?? 'N/A'), 0, 50),
                        'errors' => [$error],
                    ];
                }

                continue;
            }

            $parsed = $validation['data'];
            $paramName = $parsed['parameter_name'];
            $questionText = $parsed['question_text'];

            if (! isset($parameters[$paramName])) {
                $parameters[$paramName] = [
                    'discipline' => $parsed['discipline'],
                    'is_mandatory' => $parsed['is_mandatory'],
                    'first_row' => $rowNumber,
                    'questions' => [],
                ];
            } else {
                // Subsequent rows for the same parameter must repeat the same
                // discipline / parameter type, else silently-lost values bite us later.
                if ($parameters[$paramName]['discipline'] !== $parsed['discipline']) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'parameter_name' => $paramName,
                        'errors' => [
                            "Discipline '{$parsed['discipline']}' does not match '{$parameters[$paramName]['discipline']}' set on row {$parameters[$paramName]['first_row']} for the same parameter",
                        ],
                    ];

                    continue;
                }
                if ($parameters[$paramName]['is_mandatory'] !== $parsed['is_mandatory']) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'parameter_name' => $paramName,
                        'errors' => [
                            "Parameter Type does not match the value set on row {$parameters[$paramName]['first_row']} for the same parameter",
                        ],
                    ];

                    continue;
                }
            }

            // Detect duplicate question text within the same parameter BEFORE assignment,
            // otherwise the keyed assignment silently overwrites the prior row.
            if (isset($parameters[$paramName]['questions'][$questionText])) {
                $errors[] = [
                    'row' => $rowNumber,
                    'parameter_name' => $paramName,
                    'question_text' => substr($questionText, 0, 50),
                    'errors' => [
                        "Duplicate question text within parameter '{$paramName}' (previously seen on row {$parameters[$paramName]['questions'][$questionText]['row']})",
                    ],
                ];

                continue;
            }

            $parameters[$paramName]['questions'][$questionText] = [
                'category' => $parsed['category'],
                'weightage' => $parsed['weightage'],
                'options' => $parsed['options'],
                'row' => $rowNumber,
            ];
        }

        if (! empty($errors)) {
            return ['errors' => $errors];
        }

        return ['parameters' => $parameters];
    }

    /**
     * Validate and parse a single row.
     */
    protected function validateAndParseRow(array $rowData, int $rowNumber): array
    {
        $errors = [];
        $data = [];

        // Discipline (required)
        $discipline = isset($rowData['discipline']) ? $this->sanitizeInput($rowData['discipline']) : null;
        if (empty($discipline)) {
            $errors[] = 'Discipline is required';
        } elseif ($badName = $this->nameError('Discipline', $discipline)) {
            $errors[] = $badName;
        } else {
            $data['discipline'] = $discipline;
        }

        // Parameter Name (required)
        $parameterName = isset($rowData['parameter name']) ? $this->sanitizeInput($rowData['parameter name']) : null;
        if (empty($parameterName)) {
            $errors[] = 'Parameter Name is required';
        } elseif ($badName = $this->nameError('Parameter Name', $parameterName)) {
            $errors[] = $badName;
        } else {
            $data['parameter_name'] = $parameterName;
        }

        // Parameter Type (required: Mandatory or Optional)
        $parameterType = TextNormalizer::normalizeKey($rowData['parameter type'] ?? null);
        if ($parameterType === '') {
            $errors[] = 'Parameter Type is required';
        } elseif (! in_array($parameterType, ['mandatory', 'optional'], true)) {
            $errors[] = 'Parameter Type '.$this->quoteCell($rowData['parameter type'] ?? null).' is not valid — it must be "Mandatory" or "Optional"';
        } else {
            $data['is_mandatory'] = ($parameterType === 'mandatory');
        }

        // Question Category (required)
        $category = TextNormalizer::normalizeKey($rowData['question category'] ?? null);
        if ($category === '') {
            $errors[] = 'Question Category is required';
        } elseif (! in_array($category, $this->validCategories, true)) {
            $errors[] = 'Question Category '.$this->quoteCell($rowData['question category'] ?? null).' is not valid — it must be "Planning", "Deployment", or "Monitoring"';
        } else {
            $data['category'] = $category;
        }

        // Question Text (required)
        $questionText = isset($rowData['question text']) ? $this->sanitizeInput($rowData['question text']) : null;
        if (empty($questionText)) {
            $errors[] = 'Question Text is required';
        } elseif ($tooLong = $this->lengthError('Question Text', $rowData['question text'] ?? null)) {
            $errors[] = $tooLong;
        } else {
            $data['question_text'] = $questionText;
        }

        // Weightage (required, must be a whole number between 1 and 100)
        $weightage = isset($rowData['weightage (%)']) ? trim((string) $rowData['weightage (%)']) : '';
        if ($weightage === '') {
            $errors[] = 'Weightage (%) is required';
        } elseif (! preg_match('/^\d+$/', $weightage)) {
            $errors[] = 'Weightage (%) must be a whole number';
        } else {
            $weightageInt = (int) $weightage;
            if ($weightageInt < 1 || $weightageInt > 100) {
                $errors[] = 'Weightage (%) must be between 1 and 100';
            } else {
                $data['weightage'] = $weightageInt;
            }
        }

        // Options 1-5 (all required)
        $options = [];
        for ($i = 1; $i <= 5; $i++) {
            $optionKey = "option {$i} text";
            $optionText = isset($rowData[$optionKey]) ? $this->sanitizeInput($rowData[$optionKey]) : null;

            if (empty($optionText)) {
                $errors[] = "Option {$i} Text is required";
            } elseif ($tooLong = $this->lengthError("Option {$i} Text", $rowData[$optionKey] ?? null)) {
                $errors[] = $tooLong;
            } else {
                $options[] = $optionText;
            }
        }
        $data['options'] = $options;

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'data' => $data,
        ];
    }

    /**
     * Check every Question ID the file supplies: it must exist, and it must already belong
     * to the parameter named on the same row. Rows with a blank Question ID are new
     * questions and are skipped here.
     *
     * @param  array  $parameters  parsed rows keyed by parameter code
     * @param  Collection  $existingParameters  parameter code → AssessmentParameter
     */
    protected function validateQuestionCodes(array $parameters, $existingParameters): array
    {
        $allCodes = [];
        foreach ($parameters as $data) {
            foreach ($data['questions'] as $questionData) {
                if ($questionData['question_code'] !== null) {
                    $allCodes[] = $questionData['question_code'];
                }
            }
        }

        if (empty($allCodes)) {
            return [];
        }

        $found = AssessmentQuestion::withTrashed()
            ->whereIn('code', $allCodes)
            ->get()
            ->keyBy('code');

        $errors = [];

        foreach ($parameters as $parameterCode => $data) {
            $parameter = $existingParameters->get($parameterCode);

            foreach ($data['questions'] as $questionData) {
                $questionCode = $questionData['question_code'];
                if ($questionCode === null) {
                    continue;
                }

                $question = $found->get($questionCode);

                if (! $question) {
                    $errors[] = ['row' => $questionData['row'], 'parameter_id' => $parameterCode, 'question_id' => $questionCode, 'errors' => ["Unknown Question ID '{$questionCode}' — leave the Question ID cell empty to add this as a new question"]];

                    continue;
                }

                if ((int) $question->parameter_id !== (int) $parameter->id) {
                    $errors[] = ['row' => $questionData['row'], 'parameter_id' => $parameterCode, 'question_id' => $questionCode, 'errors' => ["Question ID '{$questionCode}' belongs to a different parameter — a question cannot be moved between parameters"]];
                }
            }
        }

        return $errors;
    }

    /**
     * Stage a question's five option rows for the batched insert. Scores are 1-5 in the
     * order the columns appear.
     *
     * @param  array  $optionRows  mutated in place
     * @param  array  $stats  mutated in place
     */
    protected function stageOptionRows(array &$optionRows, int $questionId, array $options, $now, array &$stats): void
    {
        foreach ($options as $index => $optionText) {
            $optionRows[] = [
                'question_id' => $questionId,
                'option_text' => $optionText,
                'score' => $index + 1,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            $stats['options']['created']++;
        }
    }

    /**
     * Resolve every discipline named in the file to a Discipline model, creating the ones
     * that do not exist yet. Keyed on the normalised, lowercased name.
     *
     * Matching used to be case-sensitive on the PHP side while the database compares
     * case-insensitively, so a file saying "Quality Management" against a stored "Quality
     * management" matched in SQL, missed in PHP, and created a second discipline. There is
     * no unique index on the name to catch it, so the duplicates simply accumulated and
     * split a discipline's parameters across two identical-looking entries.
     *
     * @param  array  $parameters  parsed parameter rows, each carrying a 'discipline'
     * @param  array  $stats  mutated in place; 'disciplines' counters are optional
     * @return Collection normalised name → Discipline
     */
    protected function resolveDisciplines(array $parameters, ?int $userId, array &$stats): Collection
    {
        $namesByKey = [];
        foreach (array_column($parameters, 'discipline') as $rawName) {
            $namesByKey[TextNormalizer::normalizeKey($rawName)] = TextNormalizer::normalize($rawName);
        }

        $disciplines = Discipline::whereIn('name', array_values($namesByKey))
            ->get()
            ->keyBy(fn ($discipline) => TextNormalizer::normalizeKey($discipline->name));

        foreach ($namesByKey as $key => $displayName) {
            if ($disciplines->has($key)) {
                if (isset($stats['disciplines'])) {
                    $stats['disciplines']['existing']++;
                }

                continue;
            }

            $disciplines->put($key, Discipline::create([
                'name' => $displayName,
                'created_by' => $userId,
            ]));

            if (isset($stats['disciplines'])) {
                $stats['disciplines']['created']++;
            }
        }

        return $disciplines;
    }

    /**
     * Render a cell's value for an error message so the reader can see what is actually
     * in it. An invisible character is named rather than printed, because the whole
     * difficulty with these cells is that the bad version looks identical to the good one.
     */
    protected function quoteCell(?string $raw): string
    {
        if ($raw === null || trim($raw) === '') {
            return '(empty)';
        }

        $visible = TextNormalizer::normalize($raw);
        $quoted = "'".$visible."'";

        if ($raw !== $visible) {
            $quoted .= ' (the cell contains hidden spacing characters — retype it)';
        }

        return $quoted;
    }

    /**
     * Validate that weightage sums to 100% for each parameter.
     */
    protected function validateWeightages(array $parameters): array
    {
        $errors = [];

        foreach ($parameters as $paramName => $paramData) {
            $totalWeightage = 0;

            foreach ($paramData['questions'] as $questionText => $questionData) {
                $totalWeightage += $questionData['weightage'];
            }

            if ($totalWeightage !== self::EXPECTED_WEIGHTAGE_TOTAL) {
                $errors[] = [
                    'row' => 'N/A',
                    'parameter_name' => $paramName,
                    'errors' => [
                        "Weightage sums to {$totalWeightage}%, must be ".self::EXPECTED_WEIGHTAGE_TOTAL.'%',
                    ],
                ];
            }
        }

        return $errors;
    }

    /**
     * Normalise a spreadsheet cell for storage: control characters removed, invisible
     * whitespace collapsed, trimmed, length-capped.
     *
     * No HTML stripping. strip_tags() used to run here and deleted everything between a
     * "<" and the next ">", so an option reading "scores >= 90 and <95" was stored as
     * "scores >= 90 and" with no warning and no way back. Comparison operators are
     * ordinary content in assessment text; the clients escape on output.
     */
    protected function sanitizeInput(?string $input): string
    {
        return mb_substr(Csv::unneutralize(TextNormalizer::normalize($input)), 0, self::MAX_TEXT_LENGTH);
    }

    /**
     * The same character allowlist the create and update endpoints apply, so the
     * spreadsheet is not a side door for names the forms refuse.
     */
    protected function nameError(string $label, string $value): ?string
    {
        if (preg_match(EntityName::PATTERN, $value) === 1) {
            return null;
        }

        return "{$label} ".$this->quoteCell($value)." may contain only letters, numbers, spaces and & ( ) / , . ' - :";
    }

    /**
     * Reject a cell that is longer than the column that has to hold it. Silently trimming
     * it, which is what happened before, loses the end of a question or an answer option
     * with nothing to tell the person who imported it.
     */
    protected function lengthError(string $label, ?string $raw): ?string
    {
        $length = mb_strlen(TextNormalizer::normalize($raw));

        if ($length <= self::MAX_TEXT_LENGTH) {
            return null;
        }

        return sprintf('%s is %d characters; the maximum is %d', $label, $length, self::MAX_TEXT_LENGTH);
    }
}
