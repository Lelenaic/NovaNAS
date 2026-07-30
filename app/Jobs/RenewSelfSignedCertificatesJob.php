<?php

namespace App\Jobs;

use App\Services\SslService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * Job to renew self-signed certificates that are expiring within a month.
 */
class RenewSelfSignedCertificatesJob implements ShouldQueue
{
    use Queueable;

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $sslService = app(SslService::class);

        $certsNeedingRenewal = $sslService->getSelfSignedCertificatesNeedingRenewal();

        if (empty($certsNeedingRenewal)) {
            Log::info('RenewSelfSignedCertificatesJob: No certificates need renewal');

            return;
        }

        Log::info('RenewSelfSignedCertificatesJob: Found '.count($certsNeedingRenewal).' certificate(s) needing renewal');

        $successCount = 0;
        $failureCount = 0;

        foreach ($certsNeedingRenewal as $cert) {
            $domain = $cert['domain'];

            Log::info("RenewSelfSignedCertificatesJob: Renewing certificate for {$domain}");

            $result = $sslService->renewSelfSignedCertificate($domain);

            if ($result['success']) {
                Log::info("RenewSelfSignedCertificatesJob: Certificate for {$domain} renewed successfully");
                $successCount++;
            } else {
                Log::error("RenewSelfSignedCertificatesJob: Failed to renew certificate for {$domain}: {$result['message']}");
                $failureCount++;
            }
        }

        Log::info("RenewSelfSignedCertificatesJob: Renewal complete: {$successCount} success, {$failureCount} failure(s)");
    }
}
