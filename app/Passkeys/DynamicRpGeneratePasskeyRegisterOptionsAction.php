<?php

namespace App\Passkeys;

use Illuminate\Support\Str;
use Spatie\LaravelPasskeys\Actions\GeneratePasskeyRegisterOptionsAction;
use Spatie\LaravelPasskeys\Models\Concerns\HasPasskeys;
use Spatie\LaravelPasskeys\Support\Serializer;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialRpEntity;

class DynamicRpGeneratePasskeyRegisterOptionsAction extends GeneratePasskeyRegisterOptionsAction
{
    public function execute(
        HasPasskeys $authenticatable,
        bool $asJson = true,
    ): string|PublicKeyCredentialCreationOptions {
        $options = new PublicKeyCredentialCreationOptions(
            rp: $this->relatedPartyEntity(),
            user: $this->generateUserEntity($authenticatable),
            challenge: Str::random(),
            authenticatorSelection: $this->authenticatorSelection(),
            attestation: PublicKeyCredentialCreationOptions::ATTESTATION_CONVEYANCE_PREFERENCE_NONE,
        );

        if ($asJson) {
            return Serializer::make()->toJson($options);
        }

        return $options;
    }

    protected function relatedPartyEntity(): PublicKeyCredentialRpEntity
    {
        $entity = new PublicKeyCredentialRpEntity(
            name: '',
            id: request()->getHost(),
            icon: null,
        );

        $entity->name = config('app.name', 'NovaNAS');

        return $entity;
    }
}
