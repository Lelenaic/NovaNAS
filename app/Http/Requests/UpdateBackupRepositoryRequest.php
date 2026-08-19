<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBackupRepositoryRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $repository = $this->route('repository');
        $storageType = $this->input('storage_type', $repository->storage_type);

        $rules = [
            'name' => ['sometimes', 'string', 'max:255'],
            'repo_path' => ['sometimes', 'string', 'max:500'],
        ];

        return match ($storageType) {
            'sftp' => array_merge($rules, [
                'credentials.host' => ['sometimes', 'string', 'max:255'],
                'credentials.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
                'credentials.user' => ['sometimes', 'string', 'max:255'],
                'credentials.password' => ['nullable', 'string'],
            ]),
            's3' => array_merge($rules, [
                'credentials.endpoint' => ['sometimes', 'string', 'max:500'],
                'credentials.bucket' => ['sometimes', 'string', 'max:255'],
                'credentials.region' => ['nullable', 'string', 'max:50'],
                'credentials.access_key_id' => ['sometimes', 'string', 'max:255'],
                'credentials.secret_access_key' => ['sometimes', 'string', 'max:255'],
            ]),
            'novanas_backup' => array_merge($rules, [
                'credentials.server_url' => ['sometimes', 'string', 'max:500'],
                'credentials.api_key' => ['sometimes', 'string', 'max:1000'],
                'credentials.repo_path' => ['sometimes', 'string', 'max:500'],
                'credentials.allow_unsigned_cert' => ['nullable', 'boolean'],
                'credentials.server_machine_id' => ['nullable', 'string', 'max:255'],
            ]),
            default => $rules,
        };
    }
}
