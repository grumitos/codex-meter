import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

const output = path.resolve(process.argv[2]);
const directory = path.dirname(output);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect x="8" y="8" width="240" height="240" rx="56" fill="#000"/>
  <g transform="translate(19 18) scale(3.5)" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 31V12a4 4 0 0 1 4-4h32a4 4 0 0 1 4 4v19"/>
    <path d="M10 31h44a2 2 0 0 1 2 2v2a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7v-2a2 2 0 0 1 2-2Z"/>
  </g>
  <g transform="translate(19 18) scale(3.5)" fill="#fff">
    <circle cx="32" cy="49" r="2.6"/>
    <circle cx="12" cy="58" r="2.4"/><circle cx="22" cy="58" r="2.4"/>
    <circle cx="32" cy="58" r="2.4"/><circle cx="42" cy="58" r="2.4"/>
    <circle cx="52" cy="58" r="2.4"/>
  </g>
</svg>`;

await mkdir(directory, { recursive: true });
const pngFiles = [];
for (const size of [16, 24, 32, 48, 64, 128, 256]) {
  const file = path.join(directory, `icon-${size}.png`);
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } })
    .render()
    .asPng();
  await writeFile(file, png);
  pngFiles.push(file);
}
await writeFile(output, await pngToIco(pngFiles));
