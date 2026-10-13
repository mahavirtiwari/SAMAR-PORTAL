<?php

namespace Database\Seeders;

use App\Models\AssessmentParameter;
use App\Models\AssessmentQuestion;
use App\Models\AssessmentQuestionOption;
use App\Models\Discipline;
use App\Models\ManufacturingVendorCategory;
use App\Models\ServiceVendorCategory;
use Illuminate\Database\Seeder;

class AssessmentQuestionnaireSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clean existing data (force delete to bypass soft deletes)
        $this->command->info('Cleaning existing questionnaire data...');
        AssessmentQuestionOption::query()->forceDelete();
        AssessmentQuestion::withTrashed()->forceDelete();
        AssessmentParameter::withTrashed()->forceDelete();
        Discipline::query()->delete();
        $this->command->info('Existing data cleaned.');

        // Create Disciplines
        $disciplines = $this->createDisciplines();

        // Create Parameters for each Discipline
        foreach ($disciplines as $discipline) {
            $parameters = $this->createParameters($discipline);

            // Create Questions for each Parameter
            foreach ($parameters as $parameter) {
                $questions = $this->createQuestions($parameter);

                // Create Options for each Question
                foreach ($questions as $question) {
                    $this->createOptions($question);
                }
            }
        }
    }

    /**
     * Create disciplines.
     */
    private function createDisciplines(): array
    {
        $disciplineData = [
            [
                'name' => 'Quality Management System',
                'sector' => 'manufacturing',
            ],
            [
                'name' => 'Production Management',
                'sector' => 'manufacturing',
            ],
            [
                'name' => 'Safety & Environment',
                'sector' => 'manufacturing',
            ],
            [
                'name' => 'Service Quality Management',
                'sector' => 'service',
            ],
            [
                'name' => 'Service Delivery',
                'sector' => 'service',
            ],
            [
                'name' => 'Service Safety & Compliance',
                'sector' => 'service',
            ],
        ];

        $disciplines = [];
        foreach ($disciplineData as $data) {
            $disciplines[] = Discipline::create($data);
        }

        return $disciplines;
    }

    /**
     * Enterprise sizes for both sectors.
     */
    private const ENTERPRISE_SIZES = ['startup', 'micro', 'small', 'medium', 'large'];

    /**
     * Service provider types for service sector.
     */
    private const SERVICE_PROVIDER_TYPES = [
        'annual_maintenance_contract',
        'critical_service_provider',
        'civil_works_contractor',
    ];

    /**
     * Create parameters for a discipline.
     */
    private function createParameters(Discipline $discipline): array
    {
        $parameterNames = $this->getParameterNamesForDiscipline($discipline->name);

        $parameters = [];

        // Get DRDO vendor categories based on sector
        if ($discipline->sector === 'manufacturing') {
            $drdoCategories = ManufacturingVendorCategory::where('is_active', true)
                ->pluck('id')
                ->toArray();
        } else {
            $drdoCategories = ServiceVendorCategory::where('is_active', true)
                ->pluck('id')
                ->toArray();
        }

        // For manufacturing sector: create parameters for each enterprise size
        if ($discipline->sector === 'manufacturing') {
            foreach (self::ENTERPRISE_SIZES as $enterpriseSize) {
                foreach ($parameterNames as $index => $name) {
                    // Assign DRDO category to all parameters
                    $drdoCategoryId = ! empty($drdoCategories)
                        ? $drdoCategories[array_rand($drdoCategories)]
                        : null;

                    $parameters[] = AssessmentParameter::create([
                        'name' => $name,
                        'discipline_id' => $discipline->id,
                        'sector' => $discipline->sector,
                        'enterprise_size' => $enterpriseSize,
                        'service_provider_type' => null,
                        'vendor_category_id' => $drdoCategoryId,
                    ]);
                }
            }
        }
        // For service sector: create parameters for each enterprise size AND each service provider type
        else {
            foreach (self::ENTERPRISE_SIZES as $enterpriseSize) {
                foreach (self::SERVICE_PROVIDER_TYPES as $serviceProviderType) {
                    foreach ($parameterNames as $index => $name) {
                        // Assign DRDO category to all parameters
                        $drdoCategoryId = ! empty($drdoCategories)
                            ? $drdoCategories[array_rand($drdoCategories)]
                            : null;

                        $parameters[] = AssessmentParameter::create([
                            'name' => $name,
                            'discipline_id' => $discipline->id,
                            'sector' => $discipline->sector,
                            'enterprise_size' => $enterpriseSize,
                            'service_provider_type' => $serviceProviderType,
                            'vendor_category_id' => $drdoCategoryId,
                        ]);
                    }
                }
            }
        }

        return $parameters;
    }

    /**
     * Get parameter names for a discipline.
     */
    private function getParameterNamesForDiscipline(string $disciplineName): array
    {
        return match ($disciplineName) {
            'Quality Management System' => [
                'Document Control',
                'Process Management',
                'Internal Audit',
            ],
            'Production Management' => [
                'Production Planning',
                'Equipment Maintenance',
            ],
            'Safety & Environment' => [
                'Workplace Safety',
                'Environmental Compliance',
            ],
            'Service Quality Management' => [
                'Service Standards',
                'Customer Satisfaction',
                'Quality Monitoring & Improvement',
            ],
            'Service Delivery' => [
                'Service Operations',
                'Service Level Agreements',
            ],
            'Service Safety & Compliance' => [
                'Workforce Safety & Training',
                'Regulatory & Contractual Compliance',
            ],
            default => [],
        };
    }

    /**
     * Create questions for a parameter.
     */
    private function createQuestions(AssessmentParameter $parameter): array
    {
        $questionsData = [];

        // Quality Management - Document Control (2 questions = 50 + 50 = 100)
        if ($parameter->name === 'Document Control') {
            $questionsData = [
                [
                    'question_text' => 'Are all quality documents properly controlled and versioned?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Is there a document approval process in place?',
                    'category' => 'deployment',
                    'weightage' => 50,
                ],
            ];
        }
        // Quality Management - Process Management (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Process Management') {
            $questionsData = [
                [
                    'question_text' => 'Are all critical processes documented with standard operating procedures?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Is there a process monitoring system to track performance?',
                    'category' => 'monitoring',
                    'weightage' => 50,
                ],
            ];
        }
        // Quality Management - Internal Audit (1 question = 100)
        elseif ($parameter->name === 'Internal Audit') {
            $questionsData = [
                [
                    'question_text' => 'Are internal audits conducted at planned intervals?',
                    'category' => 'monitoring',
                    'weightage' => 100,
                ],
            ];
        }
        // Production Management - Production Planning (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Production Planning') {
            $questionsData = [
                [
                    'question_text' => 'Is there a master production schedule maintained?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Are material requirements planned in advance?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
            ];
        }
        // Production Management - Equipment Maintenance (1 question = 100)
        elseif ($parameter->name === 'Equipment Maintenance') {
            $questionsData = [
                [
                    'question_text' => 'Is there a preventive maintenance schedule for all equipment?',
                    'category' => 'deployment',
                    'weightage' => 100,
                ],
            ];
        }
        // Safety & Environment - Workplace Safety (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Workplace Safety') {
            $questionsData = [
                [
                    'question_text' => 'Are all employees provided with appropriate personal protective equipment?',
                    'category' => 'deployment',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Are safety drills conducted regularly?',
                    'category' => 'monitoring',
                    'weightage' => 50,
                ],
            ];
        }
        // Safety & Environment - Environmental Compliance (1 question = 100)
        elseif ($parameter->name === 'Environmental Compliance') {
            $questionsData = [
                [
                    'question_text' => 'Are hazardous waste disposal procedures documented and followed?',
                    'category' => 'deployment',
                    'weightage' => 100,
                ],
            ];
        }
        // Service Quality Management - Service Standards (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Service Standards') {
            $questionsData = [
                [
                    'question_text' => 'Are service quality standards documented and communicated?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Is there a process to monitor service quality metrics?',
                    'category' => 'monitoring',
                    'weightage' => 50,
                ],
            ];
        }
        // Service Quality Management - Customer Satisfaction (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Customer Satisfaction') {
            $questionsData = [
                [
                    'question_text' => 'Is customer feedback collected systematically?',
                    'category' => 'monitoring',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Are customer complaints tracked and resolved within defined timelines?',
                    'category' => 'deployment',
                    'weightage' => 50,
                ],
            ];
        }
        // Service Quality Management - Quality Monitoring & Improvement (1 question = 100)
        elseif ($parameter->name === 'Quality Monitoring & Improvement') {
            $questionsData = [
                [
                    'question_text' => 'Are corrective and preventive actions taken based on quality reviews?',
                    'category' => 'monitoring',
                    'weightage' => 100,
                ],
            ];
        }
        // Service Delivery - Service Operations (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Service Operations') {
            $questionsData = [
                [
                    'question_text' => 'Are service delivery processes documented?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Are service personnel trained and competent for their assigned roles?',
                    'category' => 'deployment',
                    'weightage' => 50,
                ],
            ];
        }
        // Service Delivery - Service Level Agreements (1 question = 100)
        elseif ($parameter->name === 'Service Level Agreements') {
            $questionsData = [
                [
                    'question_text' => 'Are SLAs defined and monitored for all services?',
                    'category' => 'monitoring',
                    'weightage' => 100,
                ],
            ];
        }
        // Service Safety & Compliance - Workforce Safety & Training (2 questions = 50 + 50 = 100)
        elseif ($parameter->name === 'Workforce Safety & Training') {
            $questionsData = [
                [
                    'question_text' => 'Are service personnel provided with appropriate safety equipment and training?',
                    'category' => 'deployment',
                    'weightage' => 50,
                ],
                [
                    'question_text' => 'Are on-site safety protocols documented and communicated to the workforce?',
                    'category' => 'planning',
                    'weightage' => 50,
                ],
            ];
        }
        // Service Safety & Compliance - Regulatory & Contractual Compliance (1 question = 100)
        elseif ($parameter->name === 'Regulatory & Contractual Compliance') {
            $questionsData = [
                [
                    'question_text' => 'Are applicable statutory, regulatory and contractual obligations identified and complied with?',
                    'category' => 'monitoring',
                    'weightage' => 100,
                ],
            ];
        }

        $questions = [];
        foreach ($questionsData as $data) {
            $data['parameter_id'] = $parameter->id;
            $questions[] = AssessmentQuestion::create($data);
        }

        return $questions;
    }

    /**
     * Create options for a question.
     */
    private function createOptions(AssessmentQuestion $question): void
    {
        $optionsData = [
            [
                'option_text' => 'Yes, fully implemented with documented evidence',
                'score' => 5,
            ],
            [
                'option_text' => 'Yes, implemented but documentation needs improvement',
                'score' => 4,
            ],
            [
                'option_text' => 'Partially implemented',
                'score' => 3,
            ],
            [
                'option_text' => 'Planning stage only',
                'score' => 2,
            ],
            [
                'option_text' => 'Not implemented',
                'score' => 1,
            ],
        ];

        foreach ($optionsData as $data) {
            $data['question_id'] = $question->id;
            AssessmentQuestionOption::create($data);
        }
    }
}
