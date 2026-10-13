<?php

namespace App\Exceptions;

use Exception;

/**
 * A business-rule failure whose message is written for the end user.
 *
 * This is the ONLY exception type whose message the global handler will put on
 * the wire. Everything else is answered with a fixed generic message and a
 * reference id, so a PDOException carrying SQL, a file path, or a framework
 * internal can never reach a client — regardless of APP_DEBUG.
 *
 * The rule for authors: if you would not be happy seeing this string in an
 * auditor's report, it is not a BusinessException.
 *
 *   throw new BusinessException('This application has already been submitted.');
 *   throw new BusinessException('Assessment window has closed.', 409);
 */
class BusinessException extends Exception
{
    public function __construct(
        string $message,
        private readonly int $statusCode = 422,
        ?Exception $previous = null
    ) {
        parent::__construct($message, 0, $previous);
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
