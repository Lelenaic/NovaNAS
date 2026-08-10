<?php

namespace App\Http\Requests;

use App\Enums\BackupStorageType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBackupRepositoryRequest extends FormRequest
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
        $storageType = $this->input('storage_type', 'local');

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'storage_type' => ['required', Rule::enum(BackupStorageType::class)],
            'repo_path' => ['required', 'string', 'max:500'],
        ];

        return match ($storageType) {
            'local' => $rules,
            'sftp' => array_merge($rules, [
                'credentials.host' => ['required', 'string', 'max:255'],
                'credentials.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
                'credentials.user' => ['required', 'string', 'max:255'],
                'credentials.password' => ['nullable', 'string'],
            ]),
            's3' => array_merge($rules, [
                'credentials.endpoint' => ['required', 'string', 'max:500'],
                'credentials.bucket' => ['required', 'string', 'max:255'],
                'credentials.region' => ['nullable', 'string', 'max:50'],
                'credentials.access_key_id' => ['required', 'string', 'max:255'],
                'credentials.secret_access_key' => ['required', 'string', 'max:255'],
            ]),
            default => $rules,
        };
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Please enter a name for this repository.',
            'storage_type.required' => 'Please select a storage type.',
            'repo_path.required' => 'Please enter a repository path.',
            'credentials.host.required' => 'Please enter the SFTP host.',
            'credentials.user.required' => 'Please enter the SFTP username.',
            'credentials.endpoint.required' => 'Please enter the S3 endpoint URL.',
            'credentials.bucket.required' => 'Please enter the S3 bucket name.',
            'credentials.access_key_id.required' => 'Please enter the S3 access key ID.',
            'credentials.secret_access_key.required' => 'Please enter the S3 secret access key.',
        ];
    }
}
