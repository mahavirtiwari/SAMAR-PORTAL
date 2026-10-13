<?php

namespace Database\Seeders;

use App\Models\AssessorDomain;
use Illuminate\Database\Seeder;

class AssessorDomainsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $domains = [
            'Command Control Communication and Intelligence System, communication network, communication security systems, Signal Processing VLSI Technology (FPGA/CPLD).',
            'Unmanned Systems, Power System Engineering',
            'Processing of Composite Propellant Explosive chemical processing and systems.',
            'Solid Propulsion Technologies, Composites, Aerospace Mechanisms, NDT Techniques, System Design and Analysis, Mission Design and Studies, Guidance Design and Control Systems, Aerodynamic Decelerators, Aerostat Systems. Knowledge of Aerospace Standard (AS9100D)',
            'Mechanical systems, engine, transmission, running gear systems, armament systems, gun control systems, and fire control system.',
            'Electric/electronic systems, controllers, sensors and related technology.',
            'Aerodynamics and Air-frame Design, Computational Fluid Dynamics, Solid, Liquid, Ramjet and Scramjet Propulsion, Precision Fabrication, Systems Analysis, as well as the Command and Control systems',
            'Protective systems like body armour, vehicle armour and helmets against small arms ammunition',
            'Naval weapons and related underwater systems (sonar, underwater mines, torpedoes, fire control systems, weapon launchers, targets, decoys)',
        ];

        $count = 0;

        foreach ($domains as $d) {
            $name = mb_substr($d, 0, 255);

            $model = AssessorDomain::firstOrCreate(
                ['domain_name' => $name],
                ['is_active' => true]
            );

            if ($model->wasRecentlyCreated) {
                $count++;
            }
        }

        $this->command->info("Assessor domains seeded successfully: {$count} items");
    }
}
