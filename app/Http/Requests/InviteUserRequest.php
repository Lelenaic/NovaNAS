<?php

namespace App\Http\Requests;

use App\Services\LinuxUserService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class InviteUserRequest extends FormRequest
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
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'username' => [
                'required',
                'string',
                'regex:/^[a-z_][a-z0-9_-]*$/i',
                'max:32',
                'unique:users',
                'not_in:'.implode(',', LinuxUserService::SYSTEM_USERNAMES),
            ],
            'is_admin' => ['boolean'],
            'expires_in_hours' => ['sometimes', 'integer', 'min:1', 'max:168'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'username.required' => 'The username field is required for invitations.',
            'username.regex' => 'The username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens.',
            'username.max' => 'The username must not exceed 32 characters.',
            'email.unique' => 'A user with this email already exists.',
        ];
    }
}
