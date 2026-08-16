<?php

namespace App\Http\Controllers;

use App\Services\Firewall\UfwService;
use App\Services\SslService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for managing SSL certificate settings.
 */
class SslSettingsController extends Controller
{
    public function __construct(
        private SslService $sslService,
        private UfwService $ufwService
    ) {}

    /**
     * Get the current SSL status.
     */
    public function index(): JsonResponse
    {
        $hostname = $this->sslService->getCurrentHostname();
        $sslStatus = $this->sslService->getSslStatus();
        $hostnameConfig = $this->sslService->getHostnameDynDnsConfig();

        return response()->json([
            'hostname' => $hostname,
            'hostname_dyn_dns' => $hostnameConfig ? [
                'id' => $hostnameConfig->id,
                'name' => $hostnameConfig->name,
                'full_domain' => $hostnameConfig->full_domain,
            ] : null,
            'ssl_enabled' => $sslStatus['enabled'],
            'certificate_exists' => $sslStatus['certificate_exists'],
            'certificate_info' => $sslStatus['certificate_info'] ?? null,
        ]);
    }

    /**
     * Check if the NAS is reachable from the internet.
     */
    public function checkReachability(): JsonResponse
    {
        $result = $this->sslService->checkReachability();

        return response()->json($result);
    }

    /**
     * Issue a Let's Encrypt certificate via acme.sh.
     */
    public function issueCertificate(): JsonResponse
    {
        $hostname = $this->sslService->getCurrentHostname();

        if (! $hostname) {
            return response()->json([
                'message' => 'No hostname configured. Set a hostname in General settings or via DynDNS.',
            ], 400);
        }

        $result = $this->sslService->issueLetsEncrypt($hostname);

        if ($result['success']) {
            // Auto-install the certificate after issuance
            $installResult = $this->sslService->installCertificate($hostname);

            if (! $installResult['success']) {
                return response()->json([
                    'message' => 'Certificate issued but saving it failed: '.$installResult['message'],
                ], 500);
            }

            return response()->json([
                'message' => 'Certificate issued and saved. Enable SSL to activate it.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }

    /**
     * Install a custom certificate via acme.sh --install-cert.
     */
    public function installCertificate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'certificate' => 'required|string',
            'private_key' => 'required|string',
            'ca_bundle' => 'nullable|string',
        ]);

        $hostname = $this->sslService->getCurrentHostname();

        if (! $hostname) {
            return response()->json([
                'message' => 'No hostname configured. Set a hostname in General settings or via DynDNS.',
            ], 400);
        }

        $result = $this->sslService->installCertificate(
            $hostname,
            $validated['certificate'],
            $validated['private_key'],
            $validated['ca_bundle'] ?? null
        );

        if ($result['success']) {
            return response()->json([
                'message' => 'Certificate saved. Enable SSL to activate it.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }

    /**
     * Enable SSL on Apache.
     */
    public function enableSsl(Request $request): JsonResponse
    {
        $forceHttps = $request->boolean('force_https', false);

        $hostname = $this->sslService->getCurrentHostname();

        if (! $hostname) {
            return response()->json([
                'message' => 'No hostname configured. Set a hostname in General settings or via DynDNS.',
            ], 400);
        }

        $certExists = $this->sslService->getSslStatus()['certificate_exists'];

        if (! $certExists) {
            return response()->json([
                'message' => 'No certificate found. Issue or install a certificate first.',
            ], 400);
        }

        $result = $this->sslService->enableSsl($forceHttps);

        if ($result['success']) {
            return response()->json([
                'message' => 'SSL enabled successfully.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }

    /**
     * Check whether the firewall allows incoming traffic on a given port.
     */
    public function checkFirewallPort(): JsonResponse
    {
        $result = $this->ufwService->isPortOpen('443', 'tcp');

        return response()->json([
            'port' => '443',
            'protocol' => 'tcp',
            'firewall_active' => $result['active'],
            'open' => $result['open'],
        ]);
    }

    /**
     * Disable SSL on Apache.
     */
    public function disableSsl(): JsonResponse
    {
        $result = $this->sslService->disableSsl();

        if ($result['success']) {
            return response()->json([
                'message' => 'SSL disabled successfully.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }

    /**
     * Remove the SSL certificate.
     */
    public function deleteCertificate(): JsonResponse
    {
        $hostname = $this->sslService->getCurrentHostname();

        if (! $hostname) {
            return response()->json([
                'message' => 'No hostname configured.',
            ], 400);
        }

        // Disable SSL first if enabled
        if ($this->sslService->getSslStatus()['enabled']) {
            $this->sslService->disableSsl();
        }

        $result = $this->sslService->removeCertificate($hostname);

        if ($result['success']) {
            return response()->json([
                'message' => 'Certificate removed successfully.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }

    /**
     * Generate a self-signed certificate.
     */
    public function generateSelfSigned(): JsonResponse
    {
        $hostname = $this->sslService->getCurrentHostname();

        if (! $hostname) {
            return response()->json([
                'message' => 'No hostname configured. Set a hostname in General settings or via DynDNS.',
            ], 400);
        }

        $result = $this->sslService->generateSelfSignedCertificate($hostname);

        if ($result['success']) {
            return response()->json([
                'message' => 'Self-signed certificate generated and saved. Enable SSL to activate it.',
            ]);
        }

        return response()->json([
            'message' => $result['message'],
        ], 500);
    }
}
