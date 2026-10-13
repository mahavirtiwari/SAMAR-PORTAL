<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Core system seeders
        $this->call(RoleSeeder::class);
        $this->call(NotificationTemplateSeeder::class);

        // Common master data
        $this->call(AssessorDomainsSeeder::class);
        $this->call(ThirdPartyCertificationsSeeder::class);

        // Manufacturing sector master data
        $this->call(KeyProcessesSeeder::class);
        $this->call(DrdoVendorCategoriesSeeder::class);
        $this->call(ManufacturingStoresSeeder::class);
        $this->call(BoughtOutPartsSeeder::class);
        $this->call(RawMaterialsSeeder::class);

        // Service sector master data
        $this->call(ServiceVendorCategoriesSeeder::class);
        $this->call(ServiceVendorLabsSeeder::class);
        $this->call(ServiceKeyProcessesSeeder::class);
        $this->call(ServiceKeyResourcesSeeder::class);
        $this->call(ServiceOutsourcedComponentsSeeder::class);

        // Geographic master data
        $this->call(CountriesSeeder::class);
        $this->call(StatesSeeder::class);
        $this->call(DistrictsSeeder::class);
        $this->call(PincodeSeeder::class);

        // Configuration & System data
        $this->call(SystemAdminSeeder::class);
        $this->call(FeeConfigurationSeeder::class);
        $this->call(SystemSettingsSeeder::class);

        // Assessment questionnaire
        $this->call(AssessmentQuestionnaireSeeder::class);

        // Feedback questions
        $this->call(FeedbackQuestionSeeder::class);
    }
}
