<?php

namespace App\Console\Commands;

use App\Contracts\GstinVerifierInterface;
use Illuminate\Console\Command;

class VerifyGstin extends Command
{
    /**
     * @var string
     */
    protected $signature = 'gstin:verify {gstin : The 15-character GSTIN to verify} {--fresh : Bypass the cache and call the registry directly}';

    /**
     * @var string
     */
    protected $description = 'Verify a GSTIN live against the government registry (Protean) — also the connectivity/credentials/IP-whitelist smoke test';

    public function handle(GstinVerifierInterface $verifier): int
    {
        if (! $verifier->isEnabled()) {
            $this->error('GSTIN verification is not enabled. Set GSTIN_VERIFICATION_ENABLED=true and provide GSTIN_PROTEAN_USER_ID / GSTIN_PROTEAN_PASSWORD.');

            return self::FAILURE;
        }

        $gstin = (string) $this->argument('gstin');
        $this->info("Verifying {$gstin} via provider '{$verifier->providerName()}'...");

        $result = $verifier->verify($gstin, (bool) $this->option('fresh'));

        $this->newLine();
        $this->line("Status:        {$result->status}");
        $this->line('Verified:      '.($result->verified ? 'yes' : 'no'));

        if ($result->verified) {
            $this->line("Legal name:    {$result->legalName}");
            $this->line("Trade name:    {$result->tradeName}");
            $this->line("Constitution:  {$result->constitution}");
            $this->line("Taxpayer type: {$result->taxpayerType}");
            $this->line("GSTIN status:  {$result->gstinStatus}");
            $this->line("Registered on: {$result->registrationDate}");
        } else {
            $this->line('Error code:    '.($result->errorCode ?? '—'));
            $this->line('Reason:        '.($result->reason ?? '—'));
        }

        return $result->verified ? self::SUCCESS : self::FAILURE;
    }
}
