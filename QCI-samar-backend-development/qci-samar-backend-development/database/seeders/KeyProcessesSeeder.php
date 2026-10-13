<?php

namespace Database\Seeders;

use App\Models\ManufacturingKeyProcess;
use Illuminate\Database\Seeder;

class KeyProcessesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $processes = [
            ['process_name' => 'Assembly'],
            ['process_name' => 'Cadmium Plating'],
            ['process_name' => 'Calibration of Equipment'],
            ['process_name' => 'Casting Fixtures'],
            ['process_name' => 'Chemical Synthesis'],
            ['process_name' => 'Cnc Machining'],
            ['process_name' => 'Coating Process'],
            ['process_name' => 'Coil Bundling'],
            ['process_name' => 'Component Machining'],
            ['process_name' => 'Compression Moulding'],
            ['process_name' => 'Crimping Tools'],
            ['process_name' => 'Design'],
            ['process_name' => 'Dish Pressing'],
            ['process_name' => 'Drilling'],
            ['process_name' => 'Electroplating'],
            ['process_name' => 'Extruding'],
            ['process_name' => 'Fabrication'],
            ['process_name' => 'Fabrication And Welding'],
            ['process_name' => 'Fabrication Of Mechanical Items'],
            ['process_name' => 'Fabrication Of Tools And Fixtures'],
            ['process_name' => 'Filament Winding'],
            ['process_name' => 'Gas Cutting'],
            ['process_name' => 'Heat Treatment'],
            ['process_name' => 'Indeginisation'],
            ['process_name' => 'Installation & Commissioning'],
            ['process_name' => 'Integration'],
            ['process_name' => 'Laser Cutting'],
            ['process_name' => 'Laser Welding'],
            ['process_name' => 'Machining'],
            ['process_name' => 'Materials Testing'],
            ['process_name' => 'Mechanical Fabrication'],
            ['process_name' => 'Packing'],
            ['process_name' => 'Painting'],
            ['process_name' => 'Pcb Assembly'],
            ['process_name' => 'Pcb Design Software'],
            ['process_name' => 'Pcb Fabrication'],
            ['process_name' => 'Physical Testing At Nabl Laboratories'],
            ['process_name' => 'Plasma Cutting'],
            ['process_name' => 'Plastic Moulding'],
            ['process_name' => 'Plating'],
            ['process_name' => 'Precision Fabrication'],
            ['process_name' => 'Precision Machining'],
            ['process_name' => 'Precision Part Manufacturing'],
            ['process_name' => 'Prepregging'],
            ['process_name' => 'Research And Development of Electronics Modul'],
            ['process_name' => 'Rolling'],
            ['process_name' => 'Sheet Metal Cutting'],
            ['process_name' => 'Soldering'],
            ['process_name' => 'Stand Blasting'],
            ['process_name' => 'Surface Treatments'],
            ['process_name' => 'Tape Winding'],
            ['process_name' => 'Tapping'],
            ['process_name' => 'Testing'],
            ['process_name' => 'Thermal Insulation Lining'],
            ['process_name' => 'Tube Bending'],
            ['process_name' => 'Vmc Machining'],
            ['process_name' => 'Welding'],
            ['process_name' => 'Wire Cut'],
        ];

        foreach ($processes as $process) {
            ManufacturingKeyProcess::firstOrCreate(
                ['process_name' => $process['process_name']],
                array_merge($process, ['is_active' => true])
            );
        }

        $this->command->info('Key processes seeded successfully: '.count($processes).' items');
    }
}
