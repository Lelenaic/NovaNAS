<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBackupJobRequest extends FormRequest
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
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'is_enabled' => ['boolean'],
            'source_paths' => ['sometimes', 'array', 'min:1'],
            'source_paths.*' => ['string', 'max:500'],
            'exclude_patterns' => ['nullable', 'array'],
            'exclude_patterns.*' => ['string', 'max:500'],
            'cron_expression' => ['sometimes', 'string', 'max:100'],
            'retention_policy' => ['sometimes', 'array'],
            'retention_policy.keep_last' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_hourly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_daily' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_weekly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_monthly' => ['nullable', 'integer', 'min:0'],
            'retention_policy.keep_yearly' => ['nullable', 'integer', 'min:0'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string', 'max:50'],
            'one_file_system' => ['boolean'],
            'compression' => ['sometimes', 'string', 'in:auto,off,fastest,better,max'],
        ];
    }
}
