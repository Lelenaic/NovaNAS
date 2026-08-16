<?php

namespace App\Passkeys;

use Spatie\LaravelPasskeys\Actions\ConfigureCeremonyStepManagerFactoryAction;
use Spatie\LaravelPasskeys\Actions\FindPasskeyToAuthenticateAction;
use Spatie\LaravelPasskeys\Models\Passkey;
use Spatie\LaravelPasskeys\Support\CredentialRecordConverter;
use Throwable;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\PublicKeyCredential;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialSource;

class DynamicRpFindPasskeyToAuthenticateAction extends FindPasskeyToAuthenticateAction
{
    protected function determinePublicKeyCredentialSource(
        PublicKeyCredential $publicKeyCredential,
        PublicKeyCredentialRequestOptions $passkeyOptions,
        Passkey $passkey,
    ): ?PublicKeyCredentialSource {
        if (! $publicKeyCredential->response instanceof AuthenticatorAssertionResponse) {
            return null;
        }

        $configureCeremonyStepManagerFactoryAction = app(ConfigureCeremonyStepManagerFactoryAction::class);
        $csmFactory = $configureCeremonyStepManagerFactoryAction->execute();
        $requestCsm = $csmFactory->requestCeremony();

        $relyingPartyId = request()->getHost();

        try {
            $validator = AuthenticatorAssertionResponseValidator::create($requestCsm);

            $publicKeyCredentialSource = $validator->check(
                CredentialRecordConverter::toCredentialRecord($passkey->data),
                $publicKeyCredential->response,
                $passkeyOptions,
                $relyingPartyId,
                null,
            );
        } catch (Throwable) {
            return null;
        }

        return CredentialRecordConverter::toPublicKeyCredentialSource($publicKeyCredentialSource);
    }
}
