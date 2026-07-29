import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const [appOutput, trayWhiteOutput, trayBlackOutput] = process.argv.slice(2).map((file) => path.resolve(file));
const directory = path.dirname(appOutput);
const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const appScale = 0.8064 * 256 / 108;
const appOffset = 128 - 32 * appScale;

function markSvg({ color, scale, offsetX, offsetY, strokeWidth = 4.5, dotRadius = 2.4 }) {
  return `<g transform="translate(${offsetX} ${offsetY}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 31V12a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v19"/>
    <path d="M10 31h44a2 2 0 0 1 2 2v2a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-2a2 2 0 0 1 2-2Z"/>
  </g>
  <g transform="translate(${offsetX} ${offsetY}) scale(${scale})" fill="${color}">
    <circle cx="32" cy="49" r="${Math.max(2.6, dotRadius)}"/>
    <circle cx="12" cy="58" r="${dotRadius}"/><circle cx="22" cy="58" r="${dotRadius}"/>
    <circle cx="32" cy="58" r="${dotRadius}"/><circle cx="42" cy="58" r="${dotRadius}"/>
    <circle cx="52" cy="58" r="${dotRadius}"/>
  </g>`;
}

function renderAppSvg(size) {
  const deviceScale = appScale * size / 256;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect x="8" y="8" width="240" height="240" rx="56" fill="#000"/>
    ${markSvg({
      color: "#fff",
      scale: appScale,
      offsetX: appOffset,
      offsetY: appOffset,
      strokeWidth: Math.max(4.5, 0.95 / deviceScale),
      dotRadius: Math.max(2.4, 0.4 / deviceScale),
    })}
  </svg>`;
}

function renderTraySvg(color) {
  const scale = 3.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    ${markSvg({ color, scale, offsetX: 128 - 32 * scale, offsetY: 128 - 34 * scale })}
  </svg>`;
}

async function createIcon(output, name, renderSvg) {
  const pngFiles = [];
  for (const size of sizes) {
    const file = path.join(directory, `${name}-${size}.png`);
    const png = new Resvg(renderSvg(size), { fitTo: { mode: "width", value: size } }).render().asPng();
    await writeFile(file, png);
    pngFiles.push(file);
  }
  await writeFile(output, await pngToIco(pngFiles));
}

await mkdir(directory, { recursive: true });
await createIcon(appOutput, "app", renderAppSvg);
await createIcon(trayWhiteOutput, "tray-white", () => renderTraySvg("#fff"));
await createIcon(trayBlackOutput, "tray-black", () => renderTraySvg("#000"));
