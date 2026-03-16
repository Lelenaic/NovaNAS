<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Mail;

/**
 * Service for sending emails using SMTP settings stored in the database.
 */
class EmailService
{
    /**
     * Setting keys for SMTP configuration.
     */
    public const KEYS = [
        'smtp_host' => 'smtp_host',
        'smtp_port' => 'smtp_port',
        'smtp_username' => 'smtp_username',
        'smtp_password' => 'smtp_password',
        'smtp_encryption' => 'smtp_encryption',
        'smtp_from_address' => 'smtp_from_address',
        'smtp_from_name' => 'smtp_from_name',
    ];

    /**
     * Check if SMTP is configured.
     */
    public function isConfigured(): bool
    {
        $settings = $this->getSettings();

        return !empty($settings['smtp_host']) && !empty($settings['smtp_username']);
    }

    /**
     * Get SMTP settings from database.
     *
     * @return array<string, string|null>
     */
    public function getSettings(): array
    {
        return Setting::getMultiple(array_values(self::KEYS));
    }

    /**
     * Configure the mailer with SMTP settings from database.
     */
    public function configureMailer(): void
    {
        $settings = $this->getSettings();

        config([
            'mail.mailers.smtp.host' => $settings['smtp_host'] ?? config('mail.mailers.smtp.host'),
            'mail.mailers.smtp.port' => $settings['smtp_port'] ?? config('mail.mailers.smtp.port'),
            'mail.mailers.smtp.username' => $settings['smtp_username'] ?? config('mail.mailers.smtp.username'),
            'mail.mailers.smtp.password' => $settings['smtp_password'] ?? config('mail.mailers.smtp.password'),
            'mail.mailers.smtp.encryption' => $this->mapEncryption($settings['smtp_encryption'] ?? 'tls'),
            'mail.from.address' => $settings['smtp_from_address'] ?? config('mail.from.address'),
            'mail.from.name' => $settings['smtp_from_name'] ?? config('mail.from.name'),
        ]);
    }

    /**
     * Send an email using a Mailable class.
     *
     * @param  \Illuminate\Contracts\Mail\Mailable  $mailable
     * @return bool
     */
    public function send(\Illuminate\Contracts\Mail\Mailable $mailable): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        $this->configureMailer();

        try {
            Mail::send($mailable);

            return true;
        } catch (\Exception $e) {
            report($e);

            return false;
        }
    }

    /**
     * Send a raw text email.
     *
     * @param  string  $body
     * @param  string  $subject
     * @param  string  $to
     * @return bool
     */
    public function sendRaw(string $body, string $subject, string $to): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        $this->configureMailer();

        try {
            Mail::raw($body, function ($message) use ($subject, $to) {
                $settings = $this->getSettings();

                $message->from(
                    $settings['smtp_from_address'] ?? 'noreply@localhost',
                    $settings['smtp_from_name'] ?? 'NovaNAS'
                );
                $message->to($to);
                $message->subject($subject);
            });

            return true;
        } catch (\Exception $e) {
            report($e);

            return false;
        }
    }

    /**
     * Map encryption option to mail config value.
     */
    protected function mapEncryption(string $encryption): ?string
    {
        return match ($encryption) {
            'ssl' => 'ssl',
            'tls' => 'tls',
            default => null,
        };
    }
}
