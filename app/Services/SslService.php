<?php

namespace App\Services;

use App\Models\DynDnsConfig;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * SSL Certificate Service
 *
 * Manages SSL certificates via acme.sh, including Let's Encrypt issuance
 * and custom certificate installation.
 */
class SslService
{
    private const ACME_SH = '/root/.acme.sh/acme.sh';

    private const CERT_DIR = '/etc/ssl/novanas';

    /**
     * Get the current SSL status.
     *
     * @return array{enabled: bool, certificate_exists: bool, certificate_info?: array{domain: string, issuer: string, expires_at: string}}
     */
    public function getSslStatus(): array
    {
        $sslEnabled = $this->isSslEnabled();
        $certExists = $this->certificateExists();
        $certInfo = $certExists ? $this->getCertificateInfo() : null;

        return [
            'enabled' => $sslEnabled,
            'certificate_exists' => $certExists,
            'certificate_info' => $certInfo,
        ];
    }

    /**
     * Get the current system hostname.
     */
    public function getCurrentHostname(): ?string
    {
        $hostname = gethostname();

        return $hostname ?: null;
    }

    /**
     * Find the DynDNS config whose full_domain matches the current hostname.
     */
    public function getHostnameDynDnsConfig(): ?DynDnsConfig
    {
        $hostname = $this->getCurrentHostname();

        if (! $hostname) {
            return null;
        }

        return DynDnsConfig::where('full_domain', $hostname)->first();
    }

    /**
     * Check if the current hostname is reachable from the internet.
     *
     * @return array{reachable: bool, ip?: string, message?: string}
     */
    public function checkReachability(): array
    {
        $hostname = $this->getCurrentHostname();

        if (! $hostname) {
            return [
                'reachable' => false,
                'message' => 'No hostname configured. Set a hostname in General settings or via DynDNS.',
            ];
        }

        $apiService = app(NovaNasApiService::class);

        return $apiService->checkReachability($hostname);
    }

    /**
     * Issue a Let's Encrypt certificate via acme.sh.
     *
     * @return array{success: bool, message: string, output?: string}
     */
    public function issueLetsEncrypt(string $domain): array
    {
        $process = new Process([
            'sudo', self::ACME_SH, '--issue', '--apache', '-d', $domain, '--force',
        ]);
        $process->setTimeout(120);
        $process->run();

        if ($process->isSuccessful()) {
            Log::info('Let\'s Encrypt certificate issued', ['domain' => $domain]);

            return [
                'success' => true,
                'message' => 'Certificate issued successfully.',
                'output' => $process->getOutput(),
            ];
        }

        Log::error('Let\'s Encrypt certificate issuance failed', [
            'domain' => $domain,
            'error' => $process->getErrorOutput(),
        ]);

        return [
            'success' => false,
            'message' => 'Failed to issue certificate: '.$process->getErrorOutput(),
        ];
    }

    /**
     * Install a certificate (Let's Encrypt or custom) via acme.sh --install-cert.
     *
     * For custom certificates, the cert and key files are written to acme.sh's
     * certificate directory first, then installed via --install-cert.
     *
     * @param  string  $domain  The domain name
     * @param  string|null  $certContent  PEM certificate content (for custom certs)
     * @param  string|null  $keyContent  PEM private key content (for custom certs)
     * @param  string|null  $caContent  PEM CA bundle content (for custom certs)
     * @return array{success: bool, message: string}
     */
    public function installCertificate(string $domain, ?string $certContent = null, ?string $keyContent = null, ?string $caContent = null): array
    {
        $this->ensureCertDir();

        // For custom certificates, write files to acme.sh's storage directory
        if ($certContent !== null && $keyContent !== null) {
            $acmeDir = '/root/.acme.sh/'.$domain.'_ecc';

            $process = new Process(['sudo', 'mkdir', '-p', $acmeDir]);
            $process->run();

            if (! $process->isSuccessful()) {
                return [
                    'success' => false,
                    'message' => 'Failed to create acme.sh directory: '.$process->getErrorOutput(),
                ];
            }

            // Write certificate file
            $this->writeAcmeFile($acmeDir.'/'.$domain.'.cer', $certContent);

            // Write key file
            $this->writeAcmeFile($acmeDir.'/'.$domain.'.key', $keyContent);

            // Write CA bundle if provided
            if ($caContent) {
                $this->writeAcmeFile($acmeDir.'/ca.cer', $caContent);
            }
        }

        $process = new Process([
            'sudo', self::ACME_SH, '--install-cert', '-d', $domain,
            '--cert-file', self::CERT_DIR.'/cert.pem',
            '--key-file', self::CERT_DIR.'/privkey.pem',
            '--fullchain-file', self::CERT_DIR.'/fullchain.pem',
            '--reloadcmd', 'service apache2 force-reload',
        ]);
        $process->setTimeout(60);
        $process->run();

        if ($process->isSuccessful()) {
            Log::info('Certificate installed', ['domain' => $domain]);

            return [
                'success' => true,
                'message' => 'Certificate installed successfully.',
            ];
        }

        Log::error('Certificate installation failed', [
            'domain' => $domain,
            'error' => $process->getErrorOutput(),
        ]);

        return [
            'success' => false,
            'message' => 'Failed to install certificate: '.$process->getErrorOutput(),
        ];
    }

    /**
     * Enable SSL on Apache.
     *
     * @return array{success: bool, message: string}
     */
    public function enableSsl(): array
    {
        // Enable mod_ssl
        $process = new Process(['sudo', 'a2enmod', 'ssl']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Failed to enable mod_ssl: '.$process->getErrorOutput(),
            ];
        }

        // Write SSL VirtualHost
        $vhConfig = '<VirtualHost *:443>'."\n"
            .'    ServerName '.$this->getCurrentHostname()."\n"
            .'    DocumentRoot /var/novanas/public'."\n"
            ."\n"
            .'    SSLEngine on'."\n"
            .'    SSLCertificateFile '.self::CERT_DIR.'/fullchain.pem'."\n"
            .'    SSLCertificateKeyFile '.self::CERT_DIR.'/privkey.pem'."\n"
            ."\n"
            .'    <Directory /var/novanas/public>'."\n"
            .'        Options Indexes FollowSymLinks'."\n"
            .'        AllowOverride All'."\n"
            .'        Require all granted'."\n"
            .'    </Directory>'."\n"
            ."\n"
            .'    ErrorLog ${APACHE_LOG_DIR}/novanas_ssl_error.log'."\n"
            .'    CustomLog ${APACHE_LOG_DIR}/novanas_ssl_access.log combined'."\n"
            .'</VirtualHost>';

        $configPath = '/etc/apache2/sites-enabled/novanas-ssl.conf';

        $process = new Process(['sudo', 'bash', '-c', "cat > {$configPath} <<'VHEOF'"."\n".$vhConfig."\n".'VHEOF']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Failed to write SSL config: '.$process->getErrorOutput(),
            ];
        }

        // Config test and reload
        $process = new Process(['sudo', 'apache2ctl', 'configtest']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Apache config test failed: '.$process->getErrorOutput(),
            ];
        }

        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Failed to reload Apache: '.$process->getErrorOutput(),
            ];
        }

        Log::info('SSL enabled on Apache');

        return [
            'success' => true,
            'message' => 'SSL enabled successfully.',
        ];
    }

    /**
     * Disable SSL on Apache.
     *
     * @return array{success: bool, message: string}
     */
    public function disableSsl(): array
    {
        // Remove SSL VirtualHost
        $configPath = '/etc/apache2/sites-enabled/novanas-ssl.conf';

        $process = new Process(['sudo', 'rm', '-f', $configPath]);
        $process->run();

        // Disable mod_ssl
        $process = new Process(['sudo', 'a2dismod', 'ssl']);
        $process->run();

        // Config test and reload
        $process = new Process(['sudo', 'apache2ctl', 'configtest']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Apache config test failed: '.$process->getErrorOutput(),
            ];
        }

        $process = new Process(['sudo', 'systemctl', 'reload', 'apache2']);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Failed to reload Apache: '.$process->getErrorOutput(),
            ];
        }

        Log::info('SSL disabled on Apache');

        return [
            'success' => true,
            'message' => 'SSL disabled successfully.',
        ];
    }

    /**
     * Remove a certificate via acme.sh.
     *
     * @return array{success: bool, message: string}
     */
    public function removeCertificate(string $domain): array
    {
        $process = new Process([
            'sudo', self::ACME_SH, '--remove', '-d', $domain, '--force',
        ]);
        $process->run();

        // Remove cert files from our directory
        $process = new Process(['sudo', 'rm', '-rf', self::CERT_DIR]);
        $process->run();

        Log::info('Certificate removed', ['domain' => $domain]);

        return [
            'success' => true,
            'message' => 'Certificate removed successfully.',
        ];
    }

    /**
     * Generate a self-signed certificate using openssl and install it via acme.sh.
     *
     * @return array{success: bool, message: string}
     */
    public function generateSelfSignedCertificate(string $domain): array
    {
        $this->ensureCertDir();

        $acmeDir = '/root/.acme.sh/'.$domain.'_ecc';

        // Create acme.sh directory
        $process = new Process(['sudo', 'mkdir', '-p', $acmeDir]);
        $process->run();

        if (! $process->isSuccessful()) {
            return [
                'success' => false,
                'message' => 'Failed to create certificate directory: '.$process->getErrorOutput(),
            ];
        }

        // Generate self-signed certificate valid for 90 days (3 months)
        $process = new Process([
            'sudo', 'openssl', 'req', '-x509', '-nodes', '-days', '90',
            '-newkey', 'rsa:2048',
            '-keyout', $acmeDir.'/'.$domain.'.key',
            '-out', $acmeDir.'/'.$domain.'.cer',
            '-subj', '/CN='.$domain.'/O=NovaNAS/C=US',
        ]);
        $process->setTimeout(60);
        $process->run();

        if (! $process->isSuccessful()) {
            Log::error('Self-signed certificate generation failed', [
                'domain' => $domain,
                'error' => $process->getErrorOutput(),
            ]);

            return [
                'success' => false,
                'message' => 'Failed to generate certificate: '.$process->getErrorOutput(),
            ];
        }

        // Install the certificate via acme.sh --install-cert
        $installResult = $this->installCertificate($domain);

        if (! $installResult['success']) {
            return $installResult;
        }

        // Save metadata for renewal tracking
        $this->saveCertificateMetadata($domain, 'self-signed');

        Log::info('Self-signed certificate generated and installed', ['domain' => $domain]);

        return [
            'success' => true,
            'message' => 'Self-signed certificate generated and installed successfully.',
        ];
    }

    /**
     * Get all self-signed certificates that need renewal.
     *
     * @return array<int, array{domain: string, expires_at: string}>
     */
    public function getSelfSignedCertificatesNeedingRenewal(): array
    {
        $metadataFile = self::CERT_DIR.'/metadata.json';

        if (! file_exists($metadataFile)) {
            return [];
        }

        $metadata = json_decode(file_get_contents($metadataFile), true);

        if (! is_array($metadata)) {
            return [];
        }

        $certsNeedingRenewal = [];
        $renewalThreshold = now()->addMonth();

        foreach ($metadata as $domain => $info) {
            if (($info['type'] ?? '') !== 'self-signed') {
                continue;
            }

            $expiresAt = $info['expires_at'] ?? null;

            if (! $expiresAt) {
                // Can't determine expiry, renew to be safe
                $certsNeedingRenewal[] = [
                    'domain' => $domain,
                    'expires_at' => 'unknown',
                ];

                continue;
            }

            $expiryDate = \Carbon\Carbon::parse($expiresAt);

            if ($expiryDate->lte($renewalThreshold)) {
                $certsNeedingRenewal[] = [
                    'domain' => $domain,
                    'expires_at' => $expiresAt,
                ];
            }
        }

        return $certsNeedingRenewal;
    }

    /**
     * Renew a self-signed certificate.
     *
     * @return array{success: bool, message: string}
     */
    public function renewSelfSignedCertificate(string $domain): array
    {
        Log::info('Renewing self-signed certificate', ['domain' => $domain]);

        return $this->generateSelfSignedCertificate($domain);
    }

    /**
     * Save certificate metadata for tracking.
     */
    protected function saveCertificateMetadata(string $domain, string $type): void
    {
        $this->ensureCertDir();

        $metadataFile = self::CERT_DIR.'/metadata.json';
        $metadata = [];

        if (file_exists($metadataFile)) {
            $metadata = json_decode(file_get_contents($metadataFile), true) ?? [];
        }

        // Get expiry date from the certificate
        $expiresAt = null;
        $certFile = self::CERT_DIR.'/fullchain.pem';

        $process = new Process(['sudo', 'openssl', 'x509', '-in', $certFile, '-noout', '-enddate']);
        $process->run();

        if ($process->isSuccessful()) {
            $output = trim($process->getOutput());
            if (str_starts_with($output, 'notAfter=')) {
                $expiresAt = substr($output, 9);
            }
        }

        $metadata[$domain] = [
            'type' => $type,
            'created_at' => now()->toIso8601String(),
            'expires_at' => $expiresAt,
        ];

        $tmpFile = tempnam(sys_get_temp_dir(), 'sslmeta_');
        file_put_contents($tmpFile, json_encode($metadata, JSON_PRETTY_PRINT));

        $process = new Process(['sudo', 'cp', $tmpFile, $metadataFile]);
        $process->run();

        unlink($tmpFile);
    }

    /**
     * Check if SSL is enabled in Apache.
     */
    protected function isSslEnabled(): bool
    {
        $process = new Process(['apache2ctl', '-M']);
        $process->run();

        return $process->isSuccessful() && str_contains($process->getOutput(), 'ssl_module');
    }

    /**
     * Check if a certificate exists.
     */
    protected function certificateExists(): bool
    {
        $process = new Process(['test', '-f', self::CERT_DIR.'/fullchain.pem']);
        $process->run();

        return $process->isSuccessful();
    }

    /**
     * Get certificate information.
     *
     * @return array{domain: string, issuer: string, expires_at: string}|null
     */
    protected function getCertificateInfo(): ?array
    {
        $certFile = self::CERT_DIR.'/fullchain.pem';

        $process = new Process(['sudo', 'openssl', 'x509', '-in', $certFile, '-noout', '-subject', '-issuer', '-enddate']);
        $process->run();

        if (! $process->isSuccessful()) {
            return null;
        }

        $output = $process->getOutput();
        $domain = '';
        $issuer = '';
        $expiresAt = '';

        foreach (explode("\n", $output) as $line) {
            if (str_starts_with($line, 'subject=')) {
                preg_match('/CN\s*=\s*(.+)/', $line, $matches);
                $domain = $matches[1] ?? '';
            } elseif (str_starts_with($line, 'issuer=')) {
                preg_match('/CN\s*=\s*(.+)/', $line, $matches);
                $issuer = $matches[1] ?? '';
            } elseif (str_starts_with($line, 'notAfter=')) {
                $expiresAt = substr($line, 9);
            }
        }

        return [
            'domain' => $domain,
            'issuer' => $issuer,
            'expires_at' => $expiresAt,
        ];
    }

    /**
     * Ensure the SSL certificate directory exists.
     */
    protected function ensureCertDir(): void
    {
        $process = new Process(['sudo', 'mkdir', '-p', self::CERT_DIR]);
        $process->run();
    }

    /**
     * Write a file to the acme.sh directory via sudo.
     */
    protected function writeAcmeFile(string $path, string $content): void
    {
        $tmpFile = tempnam(sys_get_temp_dir(), 'acme_');
        file_put_contents($tmpFile, $content);

        $process = new Process(['sudo', 'cp', $tmpFile, $path]);
        $process->run();

        unlink($tmpFile);
    }
}
