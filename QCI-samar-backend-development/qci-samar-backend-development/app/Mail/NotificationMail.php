<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class NotificationMail extends Mailable
{
    /**
     * @var array<int, Attachment>
     */
    private array $mailAttachments = [];

    /**
     * @var array<int, string>
     */
    private array $bccAddresses = [];

    /**
     * Create a new message instance.
     */
    public function __construct(
        public string $mailSubject,
        public string $htmlBody,
        public string $textBody,
        array $attachments = [],
        array $bcc = []
    ) {
        $this->mailAttachments = $attachments;
        $this->bccAddresses = $bcc;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->mailSubject,
            bcc: $this->bccAddresses,
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            html: 'emails.notification',
            text: 'emails.notification-text',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return $this->mailAttachments;
    }
}
