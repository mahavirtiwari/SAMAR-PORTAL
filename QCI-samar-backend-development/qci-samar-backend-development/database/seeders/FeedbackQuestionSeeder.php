<?php

namespace Database\Seeders;

use App\Models\FeedbackQuestion;
use Illuminate\Database\Seeder;

class FeedbackQuestionSeeder extends Seeder
{
    public function run(): void
    {
        $questions = [
            [
                'question_text' => 'How would you rate the overall SAMAR portal experience?',
                'type' => FeedbackQuestion::TYPE_RATING,
                'display_order' => 1,
            ],
            [
                'question_text' => 'How satisfied are you with the application review process?',
                'type' => FeedbackQuestion::TYPE_YES_NO,
                'display_order' => 2,
            ],
            [
                'question_text' => 'Rate the ease of submitting documents on the portal.',
                'type' => FeedbackQuestion::TYPE_YES_NO,
                'display_order' => 3,
            ],
            [
                'question_text' => 'How would you rate the responsiveness of the support team?',
                'type' => FeedbackQuestion::TYPE_RATING,
                'display_order' => 4,
            ],
            [
                'question_text' => 'Was the application process easy to understand?',
                'type' => FeedbackQuestion::TYPE_RATING,
                'display_order' => 5,
            ],
        ];

        foreach ($questions as $q) {
            FeedbackQuestion::updateOrCreate(
                ['question_text' => $q['question_text']],
                [
                    'type' => $q['type'],
                    'display_order' => $q['display_order'],
                    'is_active' => true,
                ]
            );
        }
    }
}
