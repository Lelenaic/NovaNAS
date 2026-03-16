@extends('emails.layouts.default')

@section('content')
<h2>{{ $title ?? 'Notification' }}</h2>

<p>{{ $message }}</p>

@if(isset($actionUrl) && isset($actionText))
<a href="{{ $actionUrl }}" class="button">{{ $actionText }}</a>
@endif

@if(isset($details) && is_array($details))
<div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 6px;">
    <h3 style="margin-top: 0;">Details</h3>
    <dl style="margin: 0;">
        @foreach($details as $key => $value)
        <dt style="font-weight: bold; color: #666;">{{ $key }}</dt>
        <dd style="margin: 0 0 10px 0;">{{ $value }}</dd>
        @endforeach
    </dl>
</div>
@endif
@endsection
