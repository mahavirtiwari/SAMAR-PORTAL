<?php

namespace Database\Seeders;

use App\Models\ThirdPartyCertification;
use Illuminate\Database\Seeder;

class ThirdPartyCertificationsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Remove all existing certifications and re-seed with the updated list
        ThirdPartyCertification::truncate();

        $certifications = [
            ['certification_name' => 'ISO 9001'],
            ['certification_name' => 'ISO 14001'],
            ['certification_name' => 'ISO 45001'],
            ['certification_name' => 'ISO/IEC 27001'],
            ['certification_name' => 'ISO 50001'],
            ['certification_name' => 'ISO 22000'],
            ['certification_name' => 'FSSC 22000'],
            ['certification_name' => 'HACCP'],
            ['certification_name' => 'ISO 13485'],
            ['certification_name' => 'IATF 16949'],
            ['certification_name' => 'AS9100'],
            ['certification_name' => 'SA 8000'],
            ['certification_name' => 'ISO/IEC 17025'],
            ['certification_name' => 'CE Marking'],
            ['certification_name' => 'ISI Mark'],
            ['certification_name' => 'ISO 14064 (GHG)'],
            ['certification_name' => 'ISO 14046 (Water Footprint)'],
            ['certification_name' => 'ISO/IEC 20000-1'],
            ['certification_name' => 'ISO 22301 (Business Continuity)'],
            ['certification_name' => 'ISO 31000 (Risk Management)'],
            ['certification_name' => 'ISO 37001'],
        ];

        foreach ($certifications as $certification) {
            ThirdPartyCertification::firstOrCreate(
                ['certification_name' => $certification['certification_name']],
                array_merge($certification, ['is_active' => true])
            );
        }

        $this->command->info('Third party certifications seeded successfully: '.count($certifications).' items');
    }
}
