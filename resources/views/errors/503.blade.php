<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate, proxy-revalidate, private">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <meta http-equiv="Surrogate-Control" content="no-store, max-age=0">
    <title>NovaNAS - System Update in Progress</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
        }

        .container {
            text-align: center;
            padding: 40px;
            max-width: 600px;
        }

        .icon {
            font-size: 80px;
            margin-bottom: 24px;
            animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
        }

        h1 {
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #f1f5f9;
        }

        .message {
            font-size: 18px;
            color: #94a3b8;
            line-height: 1.6;
            margin-bottom: 32px;
        }

        .info-box {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
        }

        .info-box p {
            margin-bottom: 12px;
            color: #cbd5e1;
        }

        .info-box p:last-child {
            margin-bottom: 0;
        }

        .info-box strong {
            color: #38bdf8;
        }

        .countdown {
            font-size: 48px;
            font-weight: 700;
            color: #38bdf8;
            margin: 24px 0;
            font-variant-numeric: tabular-nums;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }

        .status-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .warning {
            margin-top: 24px;
            padding: 16px;
            background: rgba(234, 179, 8, 0.1);
            border: 1px solid rgba(234, 179, 8, 0.3);
            border-radius: 8px;
            color: #fde047;
            font-size: 14px;
        }

        .warning-icon {
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔧</div>

        <h1>System Update in Progress</h1>

        <p class="message">
            NovaNAS is currently updating. This page will automatically refresh every 10 seconds.
        </p>

        <div class="info-box">
            <p><strong>⏱️ Auto-refresh in:</strong></p>
            <div class="countdown" id="countdown">10</div>
            <p><strong>📡 Status:</strong></p>
            <div class="status">
                <span class="status-dot"></span>
                Waiting for update to complete...
            </div>
        </div>

        <div class="warning">
            <span class="warning-icon">⚠️</span>
            <strong>Please wait patiently.</strong> Do not shut down your system,
            turn off the power, or stop your internet connection during this update.
        </div>
    </div>

    <script>
        (function() {
            var countdown = 10;
            var countdownElement = document.getElementById('countdown');

            function updateCountdown() {
                countdown--;

                if (countdown <= 0) {
                    countdown = 10;
                    // Use cache-busting with timestamp to ensure fresh request
                    var timestamp = new Date().getTime();
                    var url = window.location.pathname;
                    // Add cache-busting query parameter
                    var separator = url.indexOf('?') > -1 ? '&' : '?';
                    window.location.href = url + separator + '_=' + timestamp;
                    return;
                }

                countdownElement.textContent = countdown;
            }

            setInterval(updateCountdown, 1000);
        })();
    </script>
</body>
</html>
