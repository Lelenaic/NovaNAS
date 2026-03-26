<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $invitationUrl,
        public string $invitedByName,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "You've been invited to join ".config('app.name', 'NovaNAS'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.invitation',
            with: [
                'user' => $this->user,
                'invitationUrl' => $this->invitationUrl,
                'invitedByName' => $this->invitedByName,
                'appName' => config('app.name', 'NovaNAS'),
                'expiresAt' => $this->user->invitation_expires_at,
            ],
        );
    }
}
