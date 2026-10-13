<?php

namespace App\Exceptions;

class FeeConfigurationMissingException extends BusinessException
{
    public static function forApplication(?string $sector, ?string $enterpriseSize): self
    {
        return new self(sprintf(
            'No fee configuration for sector "%s" and enterprise size "%s".',
            $sector ?: 'unset',
            $enterpriseSize ?: 'unset'
        ));
    }
}
