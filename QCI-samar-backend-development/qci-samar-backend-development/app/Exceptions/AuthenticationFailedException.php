<?php

namespace App\Exceptions;

/**
 * A credential, lockout or account-state failure during authentication.
 *
 * These are expected outcomes with curated, user-facing messages — not server
 * faults. Typing them lets a controller return the message deliberately instead
 * of routing it through the generic handler, whose debug field would otherwise
 * be the only thing carrying the reason (and only when APP_DEBUG is on, which
 * left the frontend depending on a field that must not exist in production).
 */
class AuthenticationFailedException extends BusinessException
{
    public function __construct(string $message)
    {
        // 401, not BusinessException's 422 default: these are credential and
        // lockout failures. Extending BusinessException means that if the explicit
        // catch in LoginController is ever removed, the global handler still
        // renders this message at the right status instead of collapsing it to a
        // generic 500 — the message is curated and safe to show either way.
        parent::__construct($message, 401);
    }
}
