<?php

namespace Database\Seeders;

use App\Models\ManufacturingVendorCategory;
use Illuminate\Database\Seeder;

class DrdoVendorCategoriesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            ['category_name' => 'Fabricator / Development Partner'],
            ['category_name' => 'Manufacturers / Distributors (MFD)'],
            ['category_name' => 'Fabrication / Production Agency (FPA)'],
            ['category_name' => 'Development and Production Agency (DPA)'],
            ['category_name' => 'Design, Development and Production Agency (DDP)'],
        ];

        foreach ($categories as $cat) {
            ManufacturingVendorCategory::firstOrCreate(
                ['category_name' => $cat['category_name']],
                array_merge($cat, ['is_active' => true])
            );
        }

        $this->command->info('DRDO vendor categories seeded successfully: '.count($categories).' items');
    }
}
