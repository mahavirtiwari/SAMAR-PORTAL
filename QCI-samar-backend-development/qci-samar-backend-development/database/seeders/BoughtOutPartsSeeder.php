<?php

namespace Database\Seeders;

use App\Models\ManufacturingBoughtOutPart;
use Illuminate\Database\Seeder;

class BoughtOutPartsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $parts = [
            ['part_name' => 'Adaptors'],
            ['part_name' => 'Aluminium Metal Blocks'],
            ['part_name' => 'Bearings'],
            ['part_name' => 'BLDC Motors'],
            ['part_name' => 'Boosters Tubes'],
            ['part_name' => 'Cables and Wire'],
            ['part_name' => 'Capacitor'],
            ['part_name' => 'Carbon Fibre'],
            ['part_name' => 'Cladded Metals'],
            ['part_name' => 'Connectors'],
            ['part_name' => 'Detector Sensor Chips'],
            ['part_name' => 'Diodes Resistors'],
            ['part_name' => 'Electronic Circuit Boards and Components'],
            ['part_name' => 'Encoders Slipring'],
            ['part_name' => 'Engine'],
            ['part_name' => 'Engineering Electrical Equipment Components Accessories'],
            ['part_name' => 'Eye Bolts'],
            ['part_name' => 'Fasteners'],
            ['part_name' => 'Fasteners Bearings and Related Products'],
            ['part_name' => 'Filters'],
            ['part_name' => 'Gauges Pt Pressure'],
            ['part_name' => 'Gear Box'],
            ['part_name' => 'Hydraulic Equipments'],
            ['part_name' => 'Hydraulic Pumps'],
            ['part_name' => 'LM Guide'],
            ['part_name' => 'Mineral Insulated Cable'],
            ['part_name' => 'Nuts and Bolts'],
            ['part_name' => 'PCB'],
            ['part_name' => 'Plugs Connectors'],
            ['part_name' => 'Potescap Motors'],
            ['part_name' => 'Power Supply Modules'],
            ['part_name' => 'Pumps'],
            ['part_name' => 'Regulators'],
            ['part_name' => 'Relays'],
            ['part_name' => 'Rubber Item'],
            ['part_name' => 'Safety Relief Valve'],
            ['part_name' => 'Sensor Chips'],
            ['part_name' => 'Sensors'],
            ['part_name' => 'Spring'],
            ['part_name' => 'Tools and Hardware'],
            ['part_name' => 'Truck Chasis'],
            ['part_name' => 'Valves'],
        ];

        foreach ($parts as $part) {
            ManufacturingBoughtOutPart::firstOrCreate(
                ['part_name' => $part['part_name']],
                array_merge($part, ['is_active' => true])
            );
        }

        $this->command->info('Bought-out parts seeded successfully: '.count($parts).' items');
    }
}
