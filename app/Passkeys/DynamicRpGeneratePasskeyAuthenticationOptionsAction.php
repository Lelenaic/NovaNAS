<?php

namespace App\Passkeys;

use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use Spatie\LaravelPasskeys\Actions\GeneratePasskeyAuthenticationOptionsAction;
use Spatie\LaravelPasskeys\Support\Serializer;
use Webauthn\PublicKeyCredentialRequestOptions;

class DynamicRpGeneratePasskeyAuthenticationOptionsAction extends GeneratePasskeyAuthenticationOptionsAction
{
    public function execute(): string
    {
        $options = new PublicKeyCredentialRequestOptions(
            challenge: Str::random(),
            rpId: request()->getHost(),
            allowCredentials: [],
        );

        $options = Serializer::make()->toJson($options);

        Session::put('passkey-authentication-options', $options);

        return $options;
    }
}
