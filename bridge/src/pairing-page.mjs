import { isIPv4 } from "node:net";

import QRCode from "qrcode";

const remoteMark = `<g fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 31V12a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v19"/><path d="M10 31h44a2 2 0 0 1 2 2v2a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-2a2 2 0 0 1 2-2Z"/></g><g fill="currentColor"><circle cx="32" cy="49" r="2.6"/><circle cx="12" cy="58" r="2.4"/><circle cx="22" cy="58" r="2.4"/><circle cx="32" cy="58" r="2.4"/><circle cx="42" cy="58" r="2.4"/><circle cx="52" cy="58" r="2.4"/></g>`;
const favicon = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><style>svg{color:#000}@media(prefers-color-scheme:dark){svg{color:#fff}}</style>${remoteMark}</svg>`)}`;

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
  <meta name="theme-color" content="#f7f7fa" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)">
  <link rel="icon" href="${favicon}">
  <title>Pair Codex Meter</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: system-ui, sans-serif;
      background: #f7f7fa;
      color: #000;
    }
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      padding: max(1.5rem, env(safe-area-inset-top)) max(1.5rem, env(safe-area-inset-right)) max(1.5rem, env(safe-area-inset-bottom)) max(1.5rem, env(safe-area-inset-left));
      display: grid;
      place-items: center;
    }
    main {
      width: min(100%, 52rem);
      padding: 2rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 18rem;
      gap: 3rem;
      align-items: center;
      border: 1px solid #dedee5;
      border-radius: 1.75rem;
      background: #fff;
    }
    .intro { min-width: 0; text-align: center; }
    .product-mark {
      display: block;
      width: 3rem;
      height: 3rem;
      margin: 0 auto .75rem;
      color: #18181b;
    }
    h1 {
      margin: 0;
      font-size: 1.625rem;
      line-height: 1.27;
      text-wrap: balance;
    }
    p {
      margin: .75rem 0 0;
      color: #5f5f68;
      font-size: 1.0625rem;
      line-height: 1.55;
      text-wrap: pretty;
    }
    .status {
      margin-top: 1.5rem;
      color: #146c2e;
      font-size: .875rem;
      font-weight: 600;
      line-height: 1.4;
    }
    code {
      display: block;
      margin-top: .5rem;
      color: #5f5f68;
      font: 500 .875rem/1.4 ui-monospace, monospace;
      overflow-wrap: anywhere;
    }
    .qr {
      overflow: hidden;
      border-radius: 1.5rem;
      background: #fff;
    }
    .qr svg { display: block; width: 100%; height: auto; }
    @media (prefers-color-scheme: dark) {
      :root { background: #000; color: #fff; }
      main { border-color: #303036; background: #000; }
      .product-mark { color: #fff; }
      p, code { color: #b8b8c0; }
      .status { color: #7ad99a; }
    }
    @media (max-width: 43.75rem) {
      body { padding: 1rem; }
      main {
        width: min(100%, 24rem);
        padding: 1.5rem;
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <main>
    <section class="intro">
      <svg class="product-mark" viewBox="0 0 64 64" aria-hidden="true">${remoteMark}</svg>
      <h1>Connect your phone</h1>
      <p>Open Codex Meter on your phone and scan this QR. Both devices must be on the same Wi-Fi network.</p>
      <div class="status" role="status">Ready to pair</div>
      <code translate="no">${endpoint}</code>
    </section>
    <div class="qr" role="img" aria-label="Codex Meter pairing QR">${qr}</div>
  </main>
  <script>
    const translations = {
      en: ["Pair Codex Meter", "Connect your phone", "Open Codex Meter on your phone and scan this QR. Both devices must be on the same Wi-Fi network.", "Ready to pair", "Codex Meter pairing QR"],
      es: ["Emparejar Codex Meter", "Conecta tu teléfono", "Abre Codex Meter en tu teléfono y escanea este QR. Ambos dispositivos deben estar en la misma red Wi-Fi.", "Listo para vincular", "QR para vincular Codex Meter"],
      pt: ["Emparelhar Codex Meter", "Conecte seu telefone", "Abra o Codex Meter no celular e escaneie este QR. Os dois dispositivos devem estar na mesma rede Wi-Fi.", "Pronto para emparelhar", "QR para emparelhar o Codex Meter"],
      fr: ["Associer Codex Meter", "Connectez votre téléphone", "Ouvrez Codex Meter sur votre téléphone et scannez ce QR. Les deux appareils doivent utiliser le même réseau Wi-Fi.", "Prêt à associer", "QR d’association de Codex Meter"],
      de: ["Codex Meter koppeln", "Smartphone verbinden", "Öffne Codex Meter auf deinem Smartphone und scanne diesen QR-Code. Beide Geräte müssen im selben WLAN sein.", "Bereit zum Koppeln", "QR-Code zum Koppeln von Codex Meter"],
      ja: ["Codex Meter をペアリング", "スマートフォンを接続", "スマートフォンで Codex Meter を開いてこの QR コードをスキャンしてください。両方のデバイスを同じ Wi-Fi に接続します。", "ペアリングの準備完了", "Codex Meter ペアリング用 QR コード"],
      ko: ["Codex Meter 페어링", "휴대전화 연결", "휴대전화에서 Codex Meter를 열고 이 QR을 스캔하세요. 두 기기가 같은 Wi-Fi에 연결되어 있어야 합니다.", "페어링 준비됨", "Codex Meter 페어링 QR"],
      zh: ["配对 Codex Meter", "连接手机", "在手机上打开 Codex Meter 并扫描此二维码。两台设备必须连接到同一 Wi-Fi 网络。", "已准备好配对", "Codex Meter 配对二维码"],
    };
    const requested = navigator.language.toLowerCase().split("-")[0];
    const language = translations[requested] ? requested : "en";
    const [title, heading, description, status, qrLabel] = translations[language];
    document.documentElement.lang = language;
    document.title = title;
    document.querySelector("h1").textContent = heading;
    document.querySelector("p").textContent = description;
    document.querySelector(".status").textContent = status;
    document.querySelector(".qr").setAttribute("aria-label", qrLabel);
  </script>
</body>
</html>
`;
}
