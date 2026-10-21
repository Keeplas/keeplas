import { Asset } from "expo-asset";
import { File } from "expo-file-system";

import interItalic from "../../../assets/fonts/Inter-Variable-Italic.woff2";
import interNormal from "../../../assets/fonts/Inter-Variable.woff2";

let css: Promise<string> | null = null;

async function face(module: number, style: "normal" | "italic") {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const data = await new File(asset.localUri ?? asset.uri).base64();
  return `@font-face { font-family: "Inter"; font-style: ${style}; font-weight: 100 900; src: url(data:font/woff2;base64,${data}) format("woff2"); }`;
}

export function interFontCss(): Promise<string> {
  css ??= Promise.all([
    face(interNormal, "normal"),
    face(interItalic, "italic"),
  ]).then((faces) => faces.join("\n"));
  css.catch(() => {
    css = null;
  });
  return css;
}
