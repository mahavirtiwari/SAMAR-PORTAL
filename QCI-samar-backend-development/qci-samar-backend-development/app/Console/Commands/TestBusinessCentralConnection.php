<?php

namespace App\Console\Commands;

use App\Contracts\BusinessCentralClientInterface;
use Illuminate\Console\Command;

class TestBusinessCentralConnection extends Command
{
    /**
     * @var string
     */
    protected $signature = 'bc:test-connection';

    /**
     * @var string
     */
    protected $description = 'Verify Business Central OAuth and connectivity to the configured company';

    public function handle(BusinessCentralClientInterface $client): int
    {
        $this->info('Testing Business Central connection...');

        $result = $client->testConnection();

        if ($result['success'] ?? false) {
            $this->info('[OK] '.$result['message']);
            if (isset($result['token_preview'])) {
                $this->line('     Token: '.$result['token_preview']);
            }

            return self::SUCCESS;
        }

        $this->error('[FAILED] '.($result['message'] ?? 'Unknown failure'));

        return self::FAILURE;
    }
}
