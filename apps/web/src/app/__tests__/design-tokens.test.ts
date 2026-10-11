import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Guards the v2 design system: every token on the Figma Foundations page
// (snapshot in PRD/v2-mobile-first/figma/tokens.json) must exist in
// globals.css with the same value, for both the light and dark themes.

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const foundations = JSON.parse(
  read("../../../../../PRD/v2-mobile-first/figma/tokens.json"),
) as {
  light: {
    primitives: Record<string, string>;
    semantic: Record<string, string>;
  };
  dark: {
    primitives: Record<string, string>;
    semantic: Record<string, string>;
  };
  typography: string[];
  spacing: Record<string, number>;
  radius: Record<string, number>;
};

const css = read("../globals.css");

/** Custom-property declarations of the first top-level block opened by `selector`. */
function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`No "${selector}" block in globals.css`);
  const body = css.slice(start, css.indexOf("\n}", start));
  const decls = new Map<string, string>();
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    decls.set(name, value.trim());
  }
  return decls;
}

const root = declarations(":root");
const dark = declarations(".dark");
const theme = declarations("@theme inline");

/** Resolves `var(--x)` chains the way the browser would for a given theme. */
function resolve(
  name: string,
  scope: readonly Map<string, string>[],
): string | undefined {
  const raw = scope.map((s) => s.get(name)).find((v) => v !== undefined);
  const ref = raw?.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(ref[1], scope) : raw;
}

/** `navy/900` → `--kp-navy-900` */
const cssName = (figmaName: string) => `--kp-${figmaName.replace("/", "-")}`;

describe.each([
  ["light", foundations.light, [root]],
  ["dark", foundations.dark, [dark, root]],
] as const)("%s theme", (_, tokens, scope) => {
  const all = { ...tokens.primitives, ...tokens.semantic };

  it.each(Object.entries(all))("%s", (figmaName, hex) => {
    expect(resolve(cssName(figmaName), scope)?.toLowerCase()).toBe(
      hex.toLowerCase(),
    );
  });

  it("exposes every semantic token to Tailwind", () => {
    for (const figmaName of Object.keys(tokens.semantic)) {
      const name = cssName(figmaName);
      expect(theme.get(name.replace("--kp-", "--color-"))).toBe(`var(${name})`);
    }
  });
});

describe("type scale", () => {
  // "Body L · Inter Regular · 17/25" → utility `text-body-lg`, 17px / 25px
  const utility: Record<string, string> = {
    "Body L": "body-lg",
    "Body S": "body-sm",
  };

  it.each(foundations.typography)("%s", (style) => {
    const [label, , metrics] = style.split(" · ");
    const [size, lineHeight] = metrics.split("/");
    const name = utility[label] ?? label.toLowerCase();
    const block = css.match(
      new RegExp(`@utility text-${name} \\{([^}]*)\\}`),
    )?.[1];

    expect(block, `@utility text-${name}`).toBeDefined();
    expect(block).toContain(`font-size: ${size}px;`);
    expect(block).toContain(`line-height: ${lineHeight}px;`);
  });
});

describe("spacing and radius", () => {
  it.each(Object.entries(foundations.spacing))("space %s", (step, px) => {
    expect(root.get(`--kp-space-${step}`)).toBe(`${px}px`);
  });

  it.each(Object.entries(foundations.radius))("radius %s", (name, px) => {
    expect(theme.get(`--radius-${name}`)).toBe(`${px}px`);
  });
});
