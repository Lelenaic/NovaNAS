@extends('emails.layouts.default')

@section('content')
<div style="text-align: center; margin-bottom: 25px;">
    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #f53003, #ff6b3d); border-radius: 16px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
    </div>
    <h2 style="margin: 0 0 8px; color: #1a1a1a; font-size: 22px;">You're Invited!</h2>
    <p style="margin: 0; color: #666; font-size: 15px;">{{ $invitedByName }} has invited you to join <strong>{{ $appName }}</strong></p>
</div>

<div style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0;">
    <table style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px;">Email</td>
            <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600; text-align: right; font-size: 14px;">{{ $user->email }}</td>
        </tr>
        @if($user->username)
        <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e5e5e5;">Username</td>
            <td style="padding: 8px 0; color: #1a1a1a; font-weight: 600; text-align: right; font-size: 14px; border-top: 1px solid #e5e5e5;">{{ $user->username }}</td>
        </tr>
        @endif
        @if($user->is_admin)
        <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e5e5e5;">Role</td>
            <td style="padding: 8px 0; text-align: right; border-top: 1px solid #e5e5e5;">
                <span style="background-color: #e3f2fd; color: #1565c0; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">Admin</span>
            </td>
        </tr>
        @endif
        @if($expiresAt)
        <tr>
            <td style="padding: 8px 0; color: #666; font-size: 14px; border-top: 1px solid #e5e5e5;">Expires</td>
            <td style="padding: 8px 0; color: #e65100; font-weight: 500; text-align: right; font-size: 14px; border-top: 1px solid #e5e5e5;">{{ $expiresAt->format('M j, Y \a\t g:i A') }}</td>
        </tr>
        @endif
    </table>
</div>

<p style="color: #555; font-size: 14px; line-height: 1.7;">
    You've been given access to <strong>{{ $appName }}</strong>. Click the button below to set your password and get started.
</p>

<div style="text-align: center; margin: 30px 0;">
    <a href="{{ $invitationUrl }}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f53003, #ff6b3d); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; letter-spacing: 0.3px;">
        Set Your Password
    </a>
</div>

<div style="background-color: #fff8e1; border-left: 4px solid #ffc107; border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 20px 0;">
    <p style="margin: 0; color: #856404; font-size: 13px;">
        <strong>Important:</strong> This invitation link will expire{{ $expiresAt ? ' on ' . $expiresAt->format('M j, Y') : '' }}. Please set your password before then.
    </p>
</div>

<p style="color: #999; font-size: 12px; margin-top: 25px;">
    If the button doesn't work, copy and paste this link into your browser:<br>
    <a href="{{ $invitationUrl }}" style="color: #f53003; word-break: break-all;">{{ $invitationUrl }}</a>
</p>
@endsection
