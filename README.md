# Codex Meter

<p align="center"><img src="assets/codex-remote.svg" width="72" height="72" alt="Codex Meter Remote mark"></p>

Codex Meter is a personal Android 1×1 widget that shows the remaining weekly Codex allowance and its reset date. A small Windows controller reads the existing local Codex CLI session; the phone receives only the remaining percentage, reset time, and stale state over the current private Wi-Fi network.

## What it does

- Shows the weekly percentage and reset date in a native Glance widget.
- Adopts launcher shape, system widget radius, dynamic colors, dark mode, font scale, and localized Android date formatting.
- Refreshes when the widget is tapped and every 30 minutes while installed.
- Shows one centered offline symbol when the PC cannot be reached.
- Pairs by QR with certificate pinning and signed requests.
- Runs silently from the Windows notification area, with no console window.

There is no history, account system, telemetry, notification service, cloud relay, or access outside the private LAN.

## Install from the release ZIP

Requirements: Windows 11 25H2, Node.js 22 or newer, and an authenticated current Codex CLI.

1. Extract the ZIP. It contains only `Codex-Meter-Windows.exe` and `Codex-Meter.apk`.
2. Double-click `Codex-Meter-Windows.exe`. It opens the pairing page and remains available in the notification area.
3. If Windows asks, allow access on private networks.
4. Install `Codex-Meter.apk` on the phone.
5. Open **Codex Meter**, scan the QR while both devices use the same Wi-Fi, and add its 1×1 widget.

Run the EXE once after each Windows sign-in. Its monochrome tray icon follows the Windows theme; hover shows the last confirmed connection state, and a click reopens the live pairing page. A second launch does the same without starting another controller. The QR is generated dynamically from the current private LAN address, port, request key, and certificate; it remains intentionally identical until one of those values changes.

## Security model

The controller binds HTTPS port `4317` directly to the selected private LAN address. The QR transfers a random 256-bit request key and the self-signed certificate fingerprint. Every request includes a timestamp, nonce, and HMAC; the Android client also pins the certificate. Codex credentials never leave Windows.

The browser page listens only on `127.0.0.1:4318`. The Android pairing screen, browser page, and tray status support English, Spanish, Portuguese, French, German, Japanese, Korean, and Chinese, with English fallback. After the first authenticated phone request, the browser removes the QR and confirms that the window can be closed. Widget reset dates use Android's locale data rather than a hand-maintained month list.

## Build from source

Requirements: Node.js 22+, authenticated Codex CLI, JDK 17, Android SDK, and ADB.

```powershell
cd bridge
npm ci
npm test

cd ../android
./gradlew.bat testDebugUnitTest lintDebug assembleDebug --no-parallel

cd ..
./scripts/build-windows.ps1
```

`./scripts/build-apk.ps1` runs the Android checks and writes `dist/Codex-Meter.apk`. `./scripts/build-windows.ps1` embeds the controller in a small .NET Framework launcher and reuses the Node.js runtime already required by Codex CLI. `./scripts/install-apk.ps1` installs the APK on the single connected ADB device, or accepts `-Serial` for a specific device.

## Closed API

`GET /v1/usage` is the only data route:

```json
{
  "remainingPercent": 65,
  "resetsAt": "2026-08-03T05:00:00.000Z",
  "stale": false
}
```

The bridge keeps the last valid weekly value. It returns that cache with `stale: true` when Codex is temporarily unavailable, or `503` when no value exists. Every other route returns `404`.

Implementation references: [Android adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive), [Android widget quality](https://developer.android.com/docs/quality-guidelines/widget-quality), [widget styling](https://developer.android.com/design/ui/mobile/guides/widgets/style), [Jetpack Glance](https://developer.android.com/develop/ui/compose/glance/create-app-widget), [Google Code Scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner), and [Codex app-server](https://learn.chatgpt.com/docs/app-server#api-overview-1).
