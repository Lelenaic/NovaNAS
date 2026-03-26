<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject ?? 'NovaNAS Notification' }}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #1a1a1a;
            color: #ffffff;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            background-color: #ffffff;
            padding: 30px;
            border: 1px solid #e5e5e5;
            border-radius: 0 0 8px 8px;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: #999;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #f53003;
            color: #ffffff;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .alert {
            padding: 15px;
            border-radius: 6px;
            margin: 15px 0;
        }
        .alert-success {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        .alert-warning {
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
        }
        .alert-danger {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ config('app.name', 'NovaNAS') }}</h1>
    </div>

    <div class="content">
        @yield('content')
    </div>

    <div class="footer">
        <p>This is an automated notification from {{ config('app.name', 'NovaNAS') }}.</p>
        <p>&copy; {{ date('Y') }} {{ config('app.name', 'NovaNAS') }}. All rights reserved.</p>
    </div>
</body>
</html>
