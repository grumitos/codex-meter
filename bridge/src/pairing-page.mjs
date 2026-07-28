import { isIPv4 } from "node:net";

import QRCode from "qrcode";

const favicon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.mark{fill:#544bd7}@media(prefers-color-scheme:dark){.mark{fill:#8e86ff}}</style><rect class="mark" x="5" y="3" width="22" height="20" rx="6"/><rect class="mark" x="9" y="25" width="14" height="4" rx="2"/></svg>`)}`;

function isPrivateIpv4(host) {
  if (!isIPv4(host)) {
    return false;
  }
  const [first, second] = host.split(".").map(Number);
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function requireBase64Url32(value, name) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
    throw new TypeError(`${name} must be 32-byte base64url`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== 32 || decoded.toString("base64url") !== value) {
    throw new TypeError(`${name} must be 32-byte base64url`);
  }
}

export function createPairingUri({ host, port, key, pin }) {
  if (!isPrivateIpv4(host)) {
    throw new TypeError("host must be a private IPv4 address");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new TypeError("port must be an integer between 1 and 65535");
  }
  if (!Buffer.isBuffer(key) || key.byteLength !== 32) {
    throw new TypeError("key must contain exactly 32 bytes");
  }
  requireBase64Url32(pin, "pin");

  return `codexmeter://pair?v=1&host=${host}&port=${port}&pin=${pin}&key=${key.toString("base64url")}`;
}

export async function renderPairingHtml(options) {
  const uri = createPairingUri(options);
  const qr = await QRCode.toString(uri, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#17171d", light: "#ffffff" },
  });
  const endpoint = `${options.host}:${options.port}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
  <link rel="icon" href="${favicon}">
  <title>Pair Codex Meter</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; background: #f4f4f7; color: #202026; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; }
    main { box-sizing: border-box; width: min(90vw, 24rem); padding: 2rem; border: 1px solid #dedee5; border-radius: 1.75rem; background: #fff; text-align: center; }
    svg { display: block; width: 100%; height: auto; border-radius: 1.25rem; }
    h1 { margin: 1.4rem 0 .45rem; font-size: 1.45rem; line-height: 1.2; }
    p { margin: 0; color: #666671; line-height: 1.5; }
    code { display: block; margin-top: .75rem; color: #666671; font: .82rem ui-monospace, monospace; }
    @media (prefers-color-scheme: dark) {
      :root { background: #111114; color: #f1f1f5; }
      main { border-color: #333339; background: #1c1c20; }
      p, code { color: #aaaab3; }
    }
  </style>
</head>
<body>
  <main>
    ${qr}
    <h1>Link Codex Meter</h1>
    <p>Open the app on your phone and scan the code on the same Wi-Fi network.</p>
    <code>${endpoint}</code>
  </main>
  <script>
    const translations = {
      en: ["Pair Codex Meter", "Link Codex Meter", "Open the app on your phone and scan the code on the same Wi-Fi network."],
      es: ["Emparejar Codex Meter", "Vincula Codex Meter", "Abre la app en tu teléfono y escanea el código desde la misma red Wi-Fi."],
      pt: ["Emparelhar Codex Meter", "Conecte o Codex Meter", "Abra o app no celular e escaneie o código na mesma rede Wi-Fi."],
      fr: ["Associer Codex Meter", "Associez Codex Meter", "Ouvrez l’app sur votre téléphone et scannez le code sur le même réseau Wi-Fi."],
      de: ["Codex Meter koppeln", "Codex Meter verbinden", "Öffne die App auf deinem Smartphone und scanne den Code im selben WLAN."],
      ja: ["Codex Meter をペアリング", "Codex Meter を接続", "スマートフォンでアプリを開き、同じ Wi-Fi ネットワーク上でコードをスキャンしてください。"],
      ko: ["Codex Meter 페어링", "Codex Meter 연결", "휴대전화에서 앱을 열고 동일한 Wi-Fi 네트워크에서 코드를 스캔하세요."],
      zh: ["配对 Codex Meter", "连接 Codex Meter", "在手机上打开应用，并在同一 Wi-Fi 网络中扫描此代码。"],
    };
    const requested = navigator.language.toLowerCase().split("-")[0];
    const language = translations[requested] ? requested : "en";
    const [title, heading, description] = translations[language];
    document.documentElement.lang = language;
    document.title = title;
    document.querySelector("h1").textContent = heading;
    document.querySelector("p").textContent = description;
  </script>
</body>
</html>
`;
}
