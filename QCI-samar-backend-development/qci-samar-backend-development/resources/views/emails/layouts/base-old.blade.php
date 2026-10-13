<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('title', 'SAMAR Portal')</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
        }
        .header h1 {
            color: #2563eb;
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px 0;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            font-size: 12px;
            color: #666666;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #2563eb;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 4px;
            margin: 10px 0;
        }
        .highlight {
            background-color: #f0f9ff;
            border-left: 4px solid #2563eb;
            padding: 15px;
            margin: 15px 0;
        }
        .otp-code {
            text-align: center;
            font-size: 32px;
            font-weight: bold;
            color: #2563eb;
            letter-spacing: 4px;
            margin: 20px 0;
        }
        a {
            color: #2563eb;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SAMAR Portal</h1>
        </div>
        <div class="content">
            @yield('content')
        </div>
        <div class="footer">
            <p>
                This is an automated email from SAMAR Certification Portal.<br>
                Please do not reply to this email.
            </p>
            <p>
                &copy; {{ date('Y') }} Quality Council of India. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
