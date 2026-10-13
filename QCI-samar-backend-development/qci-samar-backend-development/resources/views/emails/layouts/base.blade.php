<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet" />
    <title>@yield('title', 'SAMAR Portal')</title>
</head>

<body style="margin:0; padding:0; font-family:Inter, sans-serif;">

    <table width="600" border="0" cellspacing="0" cellpadding="0" bgcolor="#ECF3FF" style="font-family:Inter, sans-serif; margin: auto;">
        <tr>
            <td height="60" style="width: 100%"></td>
        </tr>

        <tr>
            <td align="center">
                <img
                    src="{{ asset('images/emails/samar-logo-2026.png') }}"
                    alt="SAMAR Logo"
                    style="width:130px; display:block; margin:auto;"
                />
            </td>
        </tr>

        <tr>
            <td height="30"></td>
        </tr>

        <!-- White Box -->
        <tr>
            <td align="center">
                <table
                    width="90%"
                    border="0"
                    cellspacing="0"
                    cellpadding="0"
                    bgcolor="#ffffff"
                    style="width:90%; max-width:90%; background:#ffffff; border-radius:10px; border-top:5px solid #3D8BFD; border-bottom:5px solid #3D8BFD; box-shadow:0 0 10px rgba(0,0,0,0.05);"
                >
                    <tr>
                        <td style="padding:30px 30px; font-family:Inter, sans-serif;">

                            <table width="100%" cellpadding="0" cellspacing="0" border="0">

                                <!-- Title (only shown if template defines email_title) -->
                                @hasSection('email_title')
                                <tr>
                                    <td align="center" style="font-size:20px; font-weight:500; color:#181C32; font-family:Inter, sans-serif;">
                                        @yield('email_title')
                                    </td>
                                </tr>

                                <tr><td height="28"></td></tr>
                                @endif

                                <!-- Email Content -->
                                @yield('content')

                            </table>

                        </td>
                    </tr>

                </table>
            </td>
        </tr>

        <tr></tr>

        <!-- Copyright -->
        <tr>
            <td align="center" style="padding:0; font-family:Inter, sans-serif;">

                <table width="90%" border="0" cellspacing="0" cellpadding="0"
                       style="width:90%; max-width:90%;">
                    <tr>
                        <td align="center" style="padding:20px 0; border-bottom:1px solid #C5DCFE;">

                            <!-- © Year styling -->
                            <span style="font-size:12px; color:#78829D; font-weight:500;">
                                Copyright &copy; {{ date('Y') }} ,
                            </span>

                            <!-- Remaining text -->
                            <span style="font-size:12px; color:#4B5675; font-weight:500;">
                                DRDO, Ministry of Defence, Government of India
                            </span>

                        </td>
                    </tr>
                </table>

            </td>
        </tr>

        <!-- Footer Logos -->
        <tr>
            <td align="center">
                <table width="90%" border="0" cellspacing="0" cellpadding="0" style="width:90%; max-width:90%; padding-bottom: 30px; padding-top: 16px;">
                    <tr>
                        <td align="left">
                            <img
                                src="{{ asset('images/emails/footer-left.png') }}"
                                alt="Left Logo"
                                style="width:184px; display:block;"
                            />
                        </td>

                        <td align="right">
                            <img
                                src="{{ asset('images/emails/footer-right.png') }}"
                                alt="Right Logo"
                                style="width:128px; display:block;"
                            />
                        </td>
                    </tr>
                </table>
            </td>
        </tr>

        <tr></tr>

    </table>
</body>
</html>
