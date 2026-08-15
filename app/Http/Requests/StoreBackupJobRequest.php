<?php

namespace App\Http\Requests;

use App\Enums\BackupCompression;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreBackupJobRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        if ($this->cron_expression === '') {
            $this->merge(['cron_expression' => null]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'backup_repository_id' => ['required', 'uuid', 'exists:backup_repositories,id'],
            'name' => ['required', 'string', 'max:255'],
            'is_enabled' => ['boolean'],
            'source_paths' => ['required', 'array', 'min:1'],
            'source_paths.*' => ['string', 'max:500'],
            'exclude_patterns' => ['nullable', 'array'],
            'exclude_patterns.*' => ['string', 'max:500'],
            'cron_expression' => ['nullable', 'string', 'max:100'],
            'retention_policy' => ['required', 'array'],
            'retention_policy.keep_last' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_hourly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_daily' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_weekly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_monthly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_yearly' => ['nullable', 'integer', 'min:0'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'one_file_system' => ['boolean'],
            'compression' => ['sometimes', Rule::enum(BackupCompression::class)],
        ];
    }

    /**
     * Get custom messages for validator errors.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'backup_repository_id.required' => 'Please select a repository.',
            'backup_repository_id.exists' => 'The selected repository does not exist.',
            'name.required' => 'Please enter a name for this job.',
            'source_paths.required' => 'Please specify at least one source path.',
            'source_paths.min' => 'Please specify at least one source path.',
            'cron_expression.string' => 'Please enter a valid schedule expression.',
        ];
    }
}
