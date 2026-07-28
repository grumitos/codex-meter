import {
  createHash,
  createPrivateKey,
  randomBytes,
  X509Certificate,
} from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { generate } from "selfsigned";

const PAIRING_KEY_FILE = "pairing-key";
const TLS_KEY_FILE = "tls-key.pem";
const TLS_CERTIFICATE_FILE = "tls-cert.pem";

function decodePairingKey(text) {
  const encoded = text.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(encoded)) {
    throw new Error("Invalid pairing material");
  }
  const key = Buffer.from(encoded, "base64url");
  if (key.byteLength !== 32 || key.toString("base64url") !== encoded) {
    throw new Error("Invalid pairing material");
  }
  return key;
}

function certificatePin(certificatePem) {
  return createHash("sha256")
    .update(new X509Certificate(certificatePem).raw)
    .digest("base64url");
}

function validateCertificatePair(privateKeyPem, certificatePem) {
  const certificate = new X509Certificate(certificatePem);
  if (!certificate.checkPrivateKey(createPrivateKey(privateKeyPem))) {
    throw new Error("Invalid pairing material");
  }
  return certificatePin(certificatePem);
}

async function readMaterial(directory) {
  const [encodedKey, privateKeyPem, certificatePem] = await Promise.all([
    readFile(path.join(directory, PAIRING_KEY_FILE), "utf8"),
    readFile(path.join(directory, TLS_KEY_FILE), "utf8"),
    readFile(path.join(directory, TLS_CERTIFICATE_FILE), "utf8"),
  ]);
  return {
    key: decodePairingKey(encodedKey),
    privateKeyPem,
    certificatePem,
    pin: validateCertificatePair(privateKeyPem, certificatePem),
  };
}

async function replacePrivateFile(filePath, contents) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function createMaterial(directory) {
  const key = randomBytes(32);
  const certificate = await generate(
    [{ name: "commonName", value: "Codex Meter" }],
    {
      algorithm: "sha256",
      days: 3_650,
      keyType: "ec",
      curve: "P-256",
      extensions: [
        { name: "basicConstraints", cA: false, critical: true },
        { name: "keyUsage", digitalSignature: true, critical: true },
        { name: "extKeyUsage", serverAuth: true },
      ],
    },
  );

  await replacePrivateFile(
    path.join(directory, PAIRING_KEY_FILE),
    `${key.toString("base64url")}\n`,
  );
  await replacePrivateFile(path.join(directory, TLS_KEY_FILE), certificate.private);
  await replacePrivateFile(
    path.join(directory, TLS_CERTIFICATE_FILE),
    certificate.cert,
  );

  return {
    key,
    privateKeyPem: certificate.private,
    certificatePem: certificate.cert,
    pin: certificatePin(certificate.cert),
  };
}

export async function loadOrCreatePairingMaterial(
  directory,
  { rotate = false } = {},
) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  if (!rotate) {
    try {
      return await readMaterial(directory);
    } catch {
      // A missing or incomplete identity is replaced as one pairing unit.
    }
  }
  return createMaterial(directory);
}
