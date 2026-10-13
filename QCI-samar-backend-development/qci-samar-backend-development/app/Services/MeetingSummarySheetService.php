<?php

namespace App\Services;

use App\Models\Assessment;
use App\Models\CommitteeMeeting;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MeetingSummarySheetService
{
    protected const DISK = 'private';

    /**
     * Per-process cache of base64-encoded static logos. A single meeting close
     * renders the MoM PDF plus one assessment-report PDF per certified assessment,
     * each embedding the same three logo files — without this they would be re-read
     * and re-encoded 1+N times in one request.
     *
     * @var array<string, string>
     */
    private static array $logoCache = [];

    protected function disk()
    {
        return Storage::disk(self::DISK);
    }

    /**
     * Generate summary sheet PDF content for a committee meeting.
     *
     * @return string PDF binary content
     */
    public function generateSummarySheetPdf(CommitteeMeeting $meeting): string
    {
        $data = [
            'meeting' => $meeting,
            'sections' => $this->groupRowsBySector($this->buildAssessmentRows($meeting)),
        ];

        $pdf = SnappyPdf::loadView('pdfs.committee.summary-sheet', $data);

        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('page-size', 'A4');
        $pdf->setOption('orientation', 'Landscape');
        $pdf->setOption('margin-top', '10mm');
        $pdf->setOption('margin-right', '8mm');
        $pdf->setOption('margin-bottom', '10mm');
        $pdf->setOption('margin-left', '8mm');

        return $pdf->output();
    }

    /**
     * Generate and store the summary sheet PDF to private storage.
     *
     * @return array ['path' => string, 'filename' => string, 'disk' => string]
     */
    public function generateAndStorePdf(CommitteeMeeting $meeting): array
    {
        $pdfContent = $this->generateSummarySheetPdf($meeting);

        $secureFilename = 'summary-sheet-'.Str::uuid().'.pdf';
        $path = "meetings/{$meeting->id}/{$secureFilename}";

        $this->disk()->put($path, $pdfContent);

        return [
            'path' => $path,
            'filename' => $secureFilename,
            'disk' => self::DISK,
        ];
    }

    /**
     * Build assessment row data for the summary sheet table.
     */
    private function buildAssessmentRows(CommitteeMeeting $meeting): array
    {
        $meeting->load([
            'meetingAssessments.assessment.application',
            'meetingAssessments.assessment.parameters',
        ]);

        $rows = [];

        foreach ($meeting->meetingAssessments as $meetingAssessment) {
            $assessment = $meetingAssessment->assessment;
            if (! $assessment) {
                continue;
            }

            $application = $assessment->application;
            if (! $application) {
                continue;
            }

            $assessorScore = $assessment->calculateAssessorOnlyScore();

            $rows[] = [
                'sector' => $application->sector === 'service' ? 'service' : 'manufacturing',
                'enterprise_name' => $application->enterprise_name ?? '-',
                'unit_name' => $application->unit_name ?? '-',
                'enterprise_classification' => $application->enterprise_classification
                    ? ucfirst($application->enterprise_classification)
                    : '-',
                'category' => $application->vendor_category ?? '-',
                'total_employees' => (($application->male_employees_count ?? 0)
                        + ($application->female_employees_count ?? 0)
                        + ($application->other_employees_count ?? 0)) ?: '-',
                'drdo_vendor' => $application->is_existing_drdo_vendor ? 'Yes' : 'No',
                'state' => $application->unit_state ?? '-',
                'commencement_date' => $application->unit_commencement_date
                    ? $application->unit_commencement_date->format('d-m-Y')
                    : '-',
                'products' => $this->formatJsonList($this->getProducts($application)),
                'key_processes' => $this->formatJsonList($this->getKeyProcesses($application)),
                'outsourced_processes' => $this->formatJsonList($this->getOutsourcedProcesses($application)),
                'customers' => $this->formatCustomers($application->customers),
                'parameters_count' => $assessment->parameters()->assessed()->count(),
                'score' => $assessorScore !== null
                    ? number_format($assessorScore, 2)
                    : '-',
                'rating' => $this->calculateRating($assessorScore),
            ];
        }

        return $rows;
    }

    /**
     * Split rows into per-sector sections so each table can carry its own
     * terminology. A meeting is not sector-scoped, so it may hold both.
     * Empty sectors are dropped; order is fixed (manufacturing first) so the
     * sheet reads the same way every time.
     *
     * @return array<int, array{sector: string, rows: array}>
     */
    private function groupRowsBySector(array $rows): array
    {
        $sections = [];

        foreach (['manufacturing', 'service'] as $sector) {
            $sectorRows = array_values(array_filter($rows, fn ($row) => $row['sector'] === $sector));

            if (! empty($sectorRows)) {
                $sections[] = ['sector' => $sector, 'rows' => $sectorRows];
            }
        }

        return $sections;
    }

    /**
     * Get products based on application sector.
     */
    private function getProducts($application): array
    {
        if ($application->sector === 'service') {
            return is_array($application->svc_services) ? $application->svc_services : [];
        }

        return is_array($application->mfg_products) ? $application->mfg_products : [];
    }

    /**
     * Get key processes based on application sector.
     */
    private function getKeyProcesses($application): array
    {
        if ($application->sector === 'service') {
            return is_array($application->svc_key_processes) ? $application->svc_key_processes : [];
        }

        return is_array($application->mfg_key_processes) ? $application->mfg_key_processes : [];
    }

    /**
     * Get outsourced processes based on application sector.
     */
    private function getOutsourcedProcesses($application): array
    {
        if ($application->sector === 'service') {
            return is_array($application->svc_outsourced_processes) ? $application->svc_outsourced_processes : [];
        }

        return is_array($application->mfg_outsourced_processes) ? $application->mfg_outsourced_processes : [];
    }

    /**
     * Format a JSON array field into a comma-separated string.
     * Handles arrays of strings or arrays of objects with a 'name' key.
     */
    private function formatJsonList(array $items): string
    {
        if (empty($items)) {
            return '-';
        }

        $values = array_map(function ($item) {
            if (is_string($item)) {
                return $item;
            }
            if (is_array($item)) {
                return $item['product_name'] ?? $item['service_name'] ?? $item['process_name'] ?? $item['store_name'] ?? $item['name'] ?? $item['title'] ?? '-';
            }

            return (string) $item;
        }, $items);

        return implode(', ', array_map('ucwords', array_filter($values)));
    }

    /**
     * Format customers array into readable string.
     */
    private function formatCustomers($customers): string
    {
        if (empty($customers) || ! is_array($customers)) {
            return '-';
        }

        $names = array_map(function ($customer) {
            if (is_string($customer)) {
                return $customer;
            }
            if (is_array($customer)) {
                return $customer['customer_name'] ?? $customer['name'] ?? '-';
            }

            return (string) $customer;
        }, $customers);

        return implode(', ', array_map('ucwords', array_filter($names)));
    }

    /**
     * Generate Minutes of Meeting PDF content.
     */
    public function generateMoMPdf(CommitteeMeeting $meeting): string
    {
        $meeting->load([
            'members.committeeMember',
            'meetingAssessments.assessment.application',
            'meetingAssessments.assessment.responses',
            'meetingAssessments.assessment.questions.feedbacks',
            'meetingAssessments.assessment.questions.parameter',
        ]);

        // Get meeting roles
        $chairName = '-';
        $convenorName = '-';
        $memberNamesList = [];

        foreach ($meeting->members as $meetingMember) {
            $name = $meetingMember->committeeMember?->full_name ?? '-';
            if ($meetingMember->role === 'chair') {
                $chairName = $name;
            } elseif ($meetingMember->role === 'convenor') {
                $convenorName = $name;
            } else {
                $memberNamesList[] = $name;
            }
        }

        // Build certified and feedback rows
        $certifiedRows = [];
        $feedbackRows = [];

        foreach ($meeting->meetingAssessments as $ma) {
            $assessment = $ma->assessment;
            if (! $assessment) {
                continue;
            }

            $application = $assessment->application;
            if (! $application) {
                continue;
            }

            $row = [
                'application_number' => $application->application_number ?? '-',
                'enterprise_name' => $application->enterprise_name ?? '-',
                'unit_name' => $application->unit_name ?? '-',
                'classification' => ucfirst($application->enterprise_classification ?? '-'),
                'state' => $application->unit_state
                    ? ($application->unit_district ? $application->unit_district.', '.$application->unit_state : $application->unit_state)
                    : '-',
                'unit_address' => $application->full_unit_address ?? '-',
                'assessor_score' => ($assessorOnly = $assessment->calculateAssessorOnlyScore()) !== null
                    ? number_format($assessorOnly, 2) : '-',
                'final_score' => $assessment->total_score !== null
                    ? number_format((float) $assessment->total_score, 2) : '-',
                'rating' => $this->calculateRating(
                    $assessment->total_score !== null ? (float) $assessment->total_score : null
                ),
            ];

            if ($ma->decision === 'certified') {
                $certifiedRows[] = $row;
            } elseif ($ma->decision === 'feedback') {
                // Get clarification parameter names from committee feedback
                $clarificationParams = [];
                foreach ($assessment->questions as $question) {
                    $hasFeedback = $question->feedbacks->contains(function ($fb) {
                        return $fb->feedback_type === 'committee_feedback';
                    });
                    if ($hasFeedback && $question->parameter) {
                        $clarificationParams[$question->parameter->name] = true;
                    }
                }

                $row['clarification_parameter'] = ! empty($clarificationParams)
                    ? implode(', ', array_keys($clarificationParams))
                    : ($ma->remarks ?? 'Clarification Required');

                $feedbackRows[] = $row;
            }
        }

        // Encode logos as base64
        $drdoLogo = $this->encodeLogoBase64('pdf/drdo_logo.png');
        $samarLogo = $this->encodeLogoBase64('pdf/samar_logo.png');
        $qciLogo = $this->encodeLogoBase64('pdf/qci_logo.png');

        $data = [
            'meeting' => $meeting,
            'startDate' => $meeting->scheduled_at?->format('d M Y') ?? '-',
            'endDate' => $meeting->ended_at?->format('d M Y') ?? ($meeting->scheduled_at?->format('d M Y') ?? '-'),
            'venue' => $meeting->venue ?? '-',
            'chairName' => $chairName,
            'convenorName' => $convenorName,
            'memberNames' => ! empty($memberNamesList) ? implode(', ', $memberNamesList) : '-',
            'certifiedRows' => $certifiedRows,
            'feedbackRows' => $feedbackRows,
            'drdoLogo' => $drdoLogo,
            'samarLogo' => $samarLogo,
            'qciLogo' => $qciLogo,
        ];

        $pdf = SnappyPdf::loadView('pdfs.committee.minutes-of-meeting', $data);

        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('page-size', 'A4');
        $pdf->setOption('orientation', 'Portrait');
        $pdf->setOption('margin-top', '10mm');
        $pdf->setOption('margin-right', '10mm');
        $pdf->setOption('margin-bottom', '10mm');
        $pdf->setOption('margin-left', '10mm');

        return $pdf->output();
    }

    /**
     * Generate and store the Minutes of Meeting PDF to private storage.
     */
    public function generateAndStoreMoMPdf(CommitteeMeeting $meeting): array
    {
        $pdfContent = $this->generateMoMPdf($meeting);

        $secureFilename = 'mom-'.Str::uuid().'.pdf';
        $path = "meetings/{$meeting->id}/{$secureFilename}";

        $this->disk()->put($path, $pdfContent);

        return [
            'path' => $path,
            'filename' => $secureFilename,
            'disk' => self::DISK,
        ];
    }

    /**
     * Generate Assessment Report PDF content for a specific assessment.
     *
     * @param  string  $decision  The committee decision (certified/feedback)
     * @return string PDF binary content
     */
    public function generateAssessmentReportPdf(Assessment $assessment, string $decision = 'certified'): string
    {
        return $this->renderAssessmentReportPdf($this->buildAssessmentReportData($assessment, $decision));
    }

    /**
     * Collect everything the assessment report template renders from.
     */
    public function buildAssessmentReportData(Assessment $assessment, string $decision = 'certified'): array
    {
        // Load all necessary relationships. The `assessed` scope on
        // ApplicationAssessmentParameter is the canonical "what's being
        // assessed" filter (mandatory ∪ assigned-to-team-member).
        $assessment->load([
            'application.certificate',
            'parameters' => fn ($q) => $q->assessed(),
            'parameters.questions',
            'responses.question',
            'openingMeeting',
            'closingMeeting',
            'sitePictures',
        ]);

        $application = $assessment->application;

        $unitAddress = $application->full_unit_address ?? '-';

        // Get location data from first site picture
        $firstPicture = $assessment->sitePictures->first();
        $latitude = $firstPicture?->latitude ?? null;
        $longitude = $firstPicture?->longitude ?? null;

        // Get assessment dates
        $assessmentStartDate = $assessment->actual_start_date?->format('d M Y')
            ?? ($assessment->scheduled_start_date?->format('d M Y') ?? '-');
        $assessmentEndDate = $assessment->actual_end_date?->format('d M Y')
            ?? ($assessment->scheduled_end_date?->format('d M Y') ?? '-');

        // Get certificate date
        $certificateDate = $application->certificate?->issue_date?->format('d M Y') ?? '-';

        // Calculate mandatory and optional parameters
        $mandatoryParameters = $assessment->parameters->where('is_mandatory', true);
        $optionalParameters = $assessment->parameters->where('is_mandatory', false);

        $mandatoryQuestionsCount = 0;
        $optionalQuestionsCount = 0;
        $mandatorySum = 0.0;
        $optionalSum = 0.0;
        $mandatoryCount = 0;
        $optionalCount = 0;

        // Get parameter-wise scores and detailed responses
        $parameterScores = [];
        $parameterDetails = [];
        $totalQuestions = 0;

        foreach ($assessment->parameters as $parameter) {
            $questions = $parameter->questions;
            $questionCount = $questions->count();
            $totalQuestions += $questionCount;

            if ($parameter->is_mandatory) {
                $mandatoryQuestionsCount += $questionCount;
            } else {
                $optionalQuestionsCount += $questionCount;
            }

            // Calculate parameter score using weighted_score sum
            $parameterWeightedScore = 0;
            $questionDetails = [];

            foreach ($questions as $question) {
                $response = $assessment->responses->where('question_id', $question->id)->first();

                if ($response && $response->weighted_score !== null) {
                    $parameterWeightedScore += (float) $response->weighted_score;
                }

                // Collect detailed question data
                $selectedOptionText = '-';
                if ($response && $response->selected_option) {
                    $selectedOptionText = $question->getOptionText($response->selected_option) ?? '-';
                }

                $questionDetails[] = [
                    'question_text' => $question->question_text,
                    'selected_option_text' => $selectedOptionText,
                    'assessor_remarks' => $response?->assessor_remarks ?? '-',
                ];
            }

            if ($parameter->is_mandatory) {
                $mandatorySum += $parameterWeightedScore;
                $mandatoryCount++;
            } else {
                $optionalSum += $parameterWeightedScore;
                $optionalCount++;
            }

            $parameterScores[] = [
                'name' => $parameter->name,
                'code' => $parameter->code,
                'discipline_name' => $parameter->discipline_name,
                'is_mandatory' => $parameter->is_mandatory,
                'question_count' => $questionCount,
                'score' => number_format($parameterWeightedScore, 2),
            ];

            $parameterDetails[] = [
                'name' => $parameter->name,
                'score' => number_format($parameterWeightedScore, 2),
                'questions' => $questionDetails,
            ];
        }

        // Get stores/categories based on sector
        $storesCategories = $this->getStoresAndCategories($application);

        // Encode logos as base64
        $drdoLogo = $this->encodeLogoBase64('pdf/drdo_logo.png');
        $samarLogo = $this->encodeLogoBase64('pdf/samar_logo.png');
        $qciLogo = $this->encodeLogoBase64('pdf/qci_logo.png');

        // Prepare photos for assessment findings
        $photos = $this->prepareAssessmentPhotos($assessment);

        return [
            'application' => $application,
            'assessment' => $assessment,
            'unitAddress' => $unitAddress,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'assessmentStartDate' => $assessmentStartDate,
            'assessmentEndDate' => $assessmentEndDate,
            'certificateDate' => $certificateDate,
            'mandatoryQuestionsCount' => $mandatoryQuestionsCount,
            'optionalQuestionsCount' => $optionalQuestionsCount,
            'mandatoryCount' => $mandatoryCount,
            'optionalCount' => $optionalCount,
            'mandatoryAvg' => $mandatoryCount > 0 ? number_format($mandatorySum / $mandatoryCount, 2) : '-',
            'optionalAvg' => $optionalCount > 0 ? number_format($optionalSum / $optionalCount, 2) : '-',
            'totalParameters' => $assessment->parameters->count(),
            'totalQuestions' => $totalQuestions,
            'totalScore' => $assessment->total_score !== null ? number_format((float) $assessment->total_score, 2) : '-',
            'ratingLevel' => $this->calculateRatingAssessmentPDF($assessment->total_score !== null ? (float) $assessment->total_score : null),
            'parameterScores' => $parameterScores,
            'parameterDetails' => $parameterDetails,
            'storesCategories' => $storesCategories,
            'photos' => $photos,
            'decision' => $decision,
            'generatedAt' => now()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A'),
            'drdoLogo' => $drdoLogo,
            'samarLogo' => $samarLogo,
            'qciLogo' => $qciLogo,
        ];
    }

    /**
     * Render the assessment report template to PDF bytes.
     *
     * The template paginates its variable sections in-document and signals completion through
     * window.status, so wkhtmltopdf must wait for that status before painting.
     */
    public function renderAssessmentReportPdf(array $data): string
    {
        $pdf = SnappyPdf::loadView('pdfs.assessment.assessment-report', $data);

        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('page-size', 'A4');
        $pdf->setOption('orientation', 'Portrait');
        $pdf->setOption('margin-top', '0mm');
        $pdf->setOption('margin-right', '0mm');
        $pdf->setOption('margin-bottom', '0mm');
        $pdf->setOption('margin-left', '0mm');
        $pdf->setOption('load-error-handling', 'ignore');
        $pdf->setOption('window-status', 'paginated');
        $pdf->setOption('no-stop-slow-scripts', true);

        return $pdf->output();
    }

    /**
     * Generate and store the Assessment Report PDF to private storage.
     *
     * @return array ['path' => string, 'filename' => string, 'disk' => string]
     */
    public function generateAndStoreAssessmentReportPdf(Assessment $assessment, string $decision = 'certified'): array
    {
        $pdfContent = $this->generateAssessmentReportPdf($assessment, $decision);

        $applicationNumber = $assessment->application?->application_number ?? 'unknown';
        $secureFilename = 'assessment-report-'.$applicationNumber.'-'.Str::uuid().'.pdf';
        $path = "assessments/{$assessment->id}/{$secureFilename}";

        $this->disk()->put($path, $pdfContent);

        return [
            'path' => $path,
            'filename' => $secureFilename,
            'disk' => self::DISK,
        ];
    }

    /**
     * Encode a logo from public path as base64 data URI.
     */
    public function encodeLogoBase64(string $relativePath): string
    {
        if (array_key_exists($relativePath, self::$logoCache)) {
            return self::$logoCache[$relativePath];
        }

        $fullPath = public_path($relativePath);
        if (! file_exists($fullPath)) {
            return self::$logoCache[$relativePath] = '';
        }

        $extension = pathinfo($fullPath, PATHINFO_EXTENSION);
        $mime = $extension === 'png' ? 'image/png' : 'image/jpeg';

        return self::$logoCache[$relativePath] = 'data:'.$mime.';base64,'.base64_encode(file_get_contents($fullPath));
    }

    /**
     * Format the rating level as "Level N" or "-" for display.
     */
    public function calculateRating(?float $score): string
    {
        $level = Assessment::ratingLevelFromScore($score);

        return $level === null ? '-' : "Level {$level}";
    }

    /**
     * Return the rating level as a bare number string ("1".."5") or "-".
     * Used by the Assessment Report PDF where the template prefixes "LEVEL".
     */
    public function calculateRatingAssessmentPDF(?float $score): string
    {
        $level = Assessment::ratingLevelFromScore($score);

        return $level === null ? '-' : (string) $level;
    }

    /**
     * Get stores/categories and products data based on application sector.
     */
    public function getStoresAndCategories($application): array
    {
        $result = [
            'stores' => [],
            'products' => [],
        ];

        if ($application->sector === 'service') {
            // Service sector - get services
            $services = is_array($application->svc_services) ? $application->svc_services : [];
            foreach ($services as $service) {
                if (is_array($service)) {
                    $result['stores'][] = [
                        'category' => $service['service_name'] ?? '-',
                        'platforms' => isset($service['platforms']) && is_array($service['platforms'])
                            ? implode(', ', $service['platforms'])
                            : '-',
                    ];
                    // For services, also add to products for category/key products display
                    $result['products'][] = [
                        'category' => $service['category_name'] ?? $service['service_name'] ?? '-',
                        'platforms' => isset($service['platforms']) && is_array($service['platforms'])
                            ? implode(', ', $service['platforms'])
                            : '-',
                    ];
                } else {
                    $result['stores'][] = [
                        'category' => $service,
                        'platforms' => '-',
                    ];
                    $result['products'][] = [
                        'category' => $service,
                        'platforms' => '-',
                    ];
                }
            }
        } else {
            // Manufacturing sector - get stores
            $mfgStores = is_array($application->mfg_drdo_vendor_stores) ? $application->mfg_drdo_vendor_stores : [];
            foreach ($mfgStores as $store) {
                if (is_array($store)) {
                    $result['stores'][] = [
                        'category' => $store['store_name'] ?? '-',
                        'platforms' => '-',
                    ];
                } else {
                    $result['stores'][] = [
                        'category' => $store,
                        'platforms' => '-',
                    ];
                }
            }

            // Get products
            $products = is_array($application->mfg_products) ? $application->mfg_products : [];
            foreach ($products as $product) {
                if (is_array($product)) {
                    $result['products'][] = [
                        'category' => $product['product_name'] ?? '-',
                        'platforms' => isset($product['platform_names']) && is_array($product['platform_names'])
                            ? implode(', ', $product['platform_names'])
                            : ($product['platform_name'] ?? '-'),
                    ];
                }
            }
        }

        return $result;
    }

    /**
     * Prepare assessment photos (site pictures and meetings).
     */
    public function prepareAssessmentPhotos(Assessment $assessment): array
    {
        $photos = [
            'site_exterior' => null,
            'site_interior' => null,
            'opening_meeting' => null,
            'closing_meeting' => null,
        ];

        // Get site pictures (first two)
        $sitePictures = $assessment->sitePictures->take(2);
        foreach ($sitePictures as $index => $picture) {
            $key = $index === 0 ? 'site_exterior' : 'site_interior';
            $photos[$key] = [
                'image' => $this->encodeImageBase64FromStorage($picture->file_path, $picture->disk),
                'latitude' => $picture->latitude,
                'longitude' => $picture->longitude,
                'timestamp' => $picture->captured_at?->copy()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A') ?? '-',
            ];
        }

        // Get opening meeting photo
        if ($assessment->openingMeeting && $assessment->openingMeeting->image_path) {
            $meeting = $assessment->openingMeeting;
            $photos['opening_meeting'] = [
                'image' => $this->encodeImageBase64FromStorage($meeting->image_path, $meeting->disk),
                'latitude' => $meeting->latitude,
                'longitude' => $meeting->longitude,
                'timestamp' => $meeting->conducted_at?->copy()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A') ?? '-',
            ];
        }

        // Get closing meeting photo
        if ($assessment->closingMeeting && $assessment->closingMeeting->image_path) {
            $meeting = $assessment->closingMeeting;
            $photos['closing_meeting'] = [
                'image' => $this->encodeImageBase64FromStorage($meeting->image_path, $meeting->disk),
                'latitude' => $meeting->latitude,
                'longitude' => $meeting->longitude,
                'timestamp' => $meeting->conducted_at?->copy()->setTimezone('Asia/Kolkata')->format('d M Y, h:i A') ?? '-',
            ];
        }

        return $photos;
    }

    /**
     * Encode an image from storage as base64 data URI.
     */
    private function encodeImageBase64FromStorage(string $path, string $disk): string
    {
        try {
            $storage = Storage::disk($disk);
            if (! $storage->exists($path)) {
                return '';
            }

            $content = $storage->get($path);
            $extension = pathinfo($path, PATHINFO_EXTENSION);
            $mime = match (strtolower($extension)) {
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                default => 'image/jpeg',
            };

            return 'data:'.$mime.';base64,'.base64_encode($content);
        } catch (\Exception $e) {
            \Log::warning('Failed to encode image from storage', [
                'path' => $path,
                'disk' => $disk,
                'error' => $e->getMessage(),
            ]);

            return '';
        }
    }
}
