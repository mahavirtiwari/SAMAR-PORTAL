<?php

namespace Database\Seeders;

use App\Models\ManufacturingRawMaterial;
use Illuminate\Database\Seeder;

class RawMaterialsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $materials = [
            ['material_name' => 'Aluminium'],
            ['material_name' => 'Aluminium Alloy'],
            ['material_name' => 'Brass'],
            ['material_name' => 'Bronze'],
            ['material_name' => 'Carbon Steel'],
            ['material_name' => 'Cast Iron'],
            ['material_name' => 'Ceramic'],
            ['material_name' => 'Composite Material'],
            ['material_name' => 'Copper'],
            ['material_name' => 'Electronic Components'],
            ['material_name' => 'Epoxy Resin'],
            ['material_name' => 'Ferrite'],
            ['material_name' => 'Fiberglass'],
            ['material_name' => 'Glass'],
            ['material_name' => 'Graphite'],
            ['material_name' => 'Inconel'],
            ['material_name' => 'Kevlar'],
            ['material_name' => 'Magnesium Alloy'],
            ['material_name' => 'Mild Steel'],
            ['material_name' => 'Nickel Alloy'],
            ['material_name' => 'Nylon'],
            ['material_name' => 'Plastic'],
            ['material_name' => 'Polycarbonate'],
            ['material_name' => 'Polyethylene'],
            ['material_name' => 'Polypropylene'],
            ['material_name' => 'Polyurethane'],
            ['material_name' => 'PVC'],
            ['material_name' => 'Rubber'],
            ['material_name' => 'Silicon'],
            ['material_name' => 'Silicone'],
            ['material_name' => 'Stainless Steel'],
            ['material_name' => 'Steel'],
            ['material_name' => 'Teflon'],
            ['material_name' => 'Titanium'],
            ['material_name' => 'Titanium Alloy'],
            ['material_name' => 'Tungsten'],
            ['material_name' => 'Zinc'],
        ];

        foreach ($materials as $material) {
            ManufacturingRawMaterial::firstOrCreate(
                ['material_name' => $material['material_name']],
                array_merge($material, ['is_active' => true])
            );
        }

        $this->command->info('Raw materials seeded successfully: '.count($materials).' items');
    }
}
