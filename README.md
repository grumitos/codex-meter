<p align="center">
  <img src="assets/codex-remote.svg" width="64" height="64" alt="Codex Meter remote mark">
</p>

<h1 align="center">Codex Meter</h1>

<p align="center">
  A tiny Android widget for your remaining weekly Codex usage,<br>
  powered by a quiet Windows tray controller on your private network.
</p>

<p align="center">
  <a href="https://github.com/grumitos/codex-meter/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/grumitos/codex-meter?display_name=tag&style=flat-square"></a>
  <img alt="Android 8 or newer" src="https://img.shields.io/badge/Android-8%2B-3DDC84?style=flat-square&logo=android&logoColor=white">
  <img alt="Windows 11" src="https://img.shields.io/badge/Windows-11-0078D4?style=flat-square&logo=windows11&logoColor=white">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/License-MIT-black?style=flat-square"></a>
</p>

<a href="https://github.com/grumitos/codex-meter/releases/latest">
  <img src="assets/codex-meter-social.png" width="100%" alt="Codex Meter 1 by 1 widget on a Samsung One UI home screen">
</a>

<p align="center"><sub>Shown on Samsung One UI. Wallpaper artwork by <a href="https://www.pixiv.net/en/users/25915682">MON</a>.</sub></p>

## Codex usage, at a glance

Codex Meter puts the only number you usually need on your home screen: the percentage left in your **weekly** Codex allowance and its reset date. Tap the widget to refresh it. If the PC is unavailable, the number is replaced by a single offline symbol.

It shows only the weekly limit reported by Codex—no speculative five-hour window, historical chart, or estimated usage.

It is intentionally small and closed in scope:

- native 1×1 Android widget;
- silent Windows 11 notification-area controller;
- QR pairing over the current private Wi-Fi network;
- no cloud service, account system, telemetry, history, or notifications.

## Quick use guide

Download the [latest release](https://github.com/grumitos/codex-meter/releases/latest). Its ZIP contains exactly two files: the Android APK and the Windows EXE.

### Windows

1. Install the current Codex CLI and sign in normally.
2. Double-click `Codex-Meter-Windows.exe`. It opens the pairing page and stays silently in the notification area.
3. Hover the tray icon for the last confirmed connection state, click it to reopen pairing, or right-click it to exit cleanly.

### Pair once

1. Keep the Windows PC and Android phone on the same private Wi-Fi network.
2. Install `Codex-Meter.apk`, open Codex Meter, and tap **Scan QR code**.
3. Scan the QR in the Windows browser. No Codex credential is copied to the phone.

### Android

1. Add the Codex Meter 1×1 widget to the home screen.
2. Read the large remaining weekly percentage and the smaller reset date below it.
3. Tap anywhere on the widget to refresh. Android also schedules a refresh approximately every 30 minutes.

When Windows cannot be reached, the widget shows a centered offline symbol. Open the Android app again only to inspect the connection or pair with another PC.

## Android and One UI themes

Yes—Codex Meter is designed to adapt to current Android themes and Samsung One UI rather than imposing a fixed widget skin.

- `GlanceTheme.colors.widgetBackground`, `onSurface`, and `onSurfaceVariant` provide launcher-aware light, dark, and dynamic colors.
- Android's system widget radius is used on Android 12 and newer, so the launcher owns the outer shape.
- The system font and locale format the typography and reset date.
- The adaptive app icon exposes a monochrome layer for themed icons.

The exact palette and shape can differ by launcher, wallpaper, Android version, and manufacturer. This is expected: Codex Meter follows the roles exposed by the host instead of trying to imitate Pixel or One UI with hard-coded colors. See Android's guidance for [dynamic widget themes](https://developer.android.com/design/ui/mobile/guides/widgets/style), [Glance theming](https://developer.android.com/codelabs/glance#6), and [system widget radii](https://developer.android.com/develop/ui/compose/glance/create-app-widget#rounded-corners). Samsung likewise recommends calm surfaces, readable contrast, and distinct light/dark treatment in its [One UI color system](https://developer.samsung.com/one-ui/color/system.html).

## Language support

English, Spanish, Portuguese, French, German, Japanese, Korean, and Simplified Chinese are supported, with English fallback.

- The Android app follows the phone's active system language through native Android resources.
- Widget reset dates use Android's locale data, so month and day formatting follow the phone language and region automatically.
- The Windows tray follows the Windows interface language.
- The pairing page follows the browser language. Chrome normally inherits the Windows preference, but an explicitly configured Chrome language takes precedence.

## How it works

The Windows controller starts `codex app-server` through its standard input/output protocol and reads the weekly rate-limit window. It exposes only the normalized widget payload to the paired phone.

- HTTPS usage endpoint: the selected private LAN address on port `4317`.
- Local pairing page: `127.0.0.1:4318` only.
- Refresh: widget tap plus Android's periodic 30-minute work window.
- Offline behavior: retain the last valid value internally and show an explicit offline state.

The QR is generated from the current LAN address, request key, and certificate pin. It stays the same while that pairing identity and endpoint remain unchanged.

## Security and privacy

Codex credentials never leave Windows. Pairing transfers a random 256-bit request key and the self-signed certificate fingerprint. Android pins that certificate, and every usage request carries a timestamp, nonce, and HMAC signature. Replay, expired, unsigned, and incorrectly signed requests are rejected.

The bridge returns only:

```json
{
  "remainingPercent": 65,
  "resetsAt": "2026-08-03T05:00:00.000Z",
  "stale": false
}
```

There is no relay and no internet-facing listener. Use Codex Meter only on a private network you trust.

## Requirements

### Use

- Windows 11 25H2
- Node.js 22 or newer
- current authenticated Codex CLI
- Android 8.0 or newer

### Build

- Node.js 22 or newer
- JDK 17
- Android SDK 36
- ADB for device installation

```powershell
cd bridge
npm ci
npm test

cd ../android
./gradlew.bat testDebugUnitTest lintDebug assembleDebug --no-parallel

cd ..
./scripts/build-windows.ps1
```

`scripts/build-apk.ps1` runs the Android checks and writes `dist/Codex-Meter.apk`. `scripts/build-windows.ps1` embeds the bridge in a small .NET Framework tray launcher and reuses the Node.js runtime required by Codex CLI. `scripts/install-apk.ps1` installs the APK on a connected ADB device.

## Project scope

Codex Meter deliberately does not include historical charts, multiple accounts, credits, notifications, Play Store publishing, a remote relay, or web scraping. The repository favors a small deterministic implementation over speculative compatibility layers.

## Credits

- Screenshot wallpaper artwork: [MON on Pixiv](https://www.pixiv.net/en/users/25915682). The artwork remains the property of its creator and is not covered by this repository's software license.
- Built with [Jetpack Glance](https://developer.android.com/develop/ui/compose/glance), [WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent), and the official [Codex app-server protocol](https://developers.openai.com/codex/app-server/).

Codex Meter is an unofficial open-source companion and is not affiliated with or endorsed by OpenAI. Codex, ChatGPT, and their respective marks belong to OpenAI.

## License

The software is available under the [MIT License](LICENSE). Third-party artwork shown in presentation screenshots is excluded.
