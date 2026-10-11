import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FIGMA_SCREENS = fileURLToPath(
  new URL("../../../PRD/v2-mobile-first/figma/screens/", import.meta.url),
);

/**
 * Agreed threshold for light screens vs Figma: at most 4 % of pixels may
 * differ, a pixel counting as different when its YIQ color distance exceeds
 * 0.1 (pixelmatch `threshold`), anti-aliased pixels ignored. Browser text
 * rasterization never matches Figma's exactly, so a few percent of glyph
 * edges always differ even on a faithful build; layout or color mistakes
 * show up well above that.
 */
const MAX_DIFF_RATIO = 0.04;
const PIXEL_THRESHOLD = 0.1;

/** Screens without a Figma reference vs their own committed baseline. */
const BASELINE_MAX_DIFF_RATIO = 0.01;
const THEMES = ["light", "dark"] as const;

interface Case {
  id: string;
  /** Figma PNG in figma/screens/, or null when Figma has none. */
  figma: string | null;
  width: number;
  height: number;
  lang?: "en" | "fr";
  /** Brings the screen to the drawn state (open menu, focus…). */
  prepare?: (page: Page) => Promise<void>;
}

const SHELL = { width: 1440, height: 900 };

const CASES: Case[] = [
  { id: "W04-3", figma: "W04-3_Dashboard.png", ...SHELL },
  {
    id: "W04-3b",
    figma: "W04-3b_Dashboard_Add_item_menu.png",
    ...SHELL,
    // Figma draws the first entry highlighted.
    prepare: (page) => page.keyboard.press("ArrowDown"),
  },
  { id: "W04-3-empty", figma: null, ...SHELL },
  { id: "W04-4", figma: "W04-4_Shared_with_me.png", ...SHELL },
  { id: "W04-4-empty", figma: null, ...SHELL },
  {
    id: "W04-5",
    figma: "W04-5_Recovery_center_status_only_.png",
    ...SHELL,
  },
  { id: "W04-6", figma: "W04-6_Devices_and_security.png", ...SHELL },
  { id: "W04-7", figma: "W04-7_Settings.png", ...SHELL },
];

async function open(page: Page, item: Case, theme: "light" | "dark") {
  // Same clock as the fixtures: Sunday 11 Oct 2026, 09:00 (greeting, dates).
  await page.clock.setFixedTime(new Date("2026-10-11T09:00:00+02:00"));
  // The harness Convex client must never reach a backend.
  await page.routeWebSocket(/convex\.cloud/, () => {});
  await page.setViewportSize({ width: item.width, height: item.height });
  await page.goto(
    `/?screen=${item.id}&theme=${theme}&lang=${item.lang ?? "en"}`,
  );
  await page.evaluate(() => document.fonts.ready);
  await item.prepare?.(page);
}

for (const item of CASES) {
  if (item.figma) {
    test(`${item.id} light matches Figma`, async ({ page }, info) => {
      await open(page, item, "light");
      const actual = PNG.sync.read(
        await page.screenshot({ animations: "disabled" }),
      );
      const expected = PNG.sync.read(
        readFileSync(`${FIGMA_SCREENS}${item.figma}`),
      );
      const diff = new PNG({ width: item.width, height: item.height });
      const mismatched = pixelmatch(
        expected.data,
        actual.data,
        diff.data,
        item.width,
        item.height,
        { threshold: PIXEL_THRESHOLD },
      );
      const ratio = mismatched / (item.width * item.height);
      info.annotations.push({
        type: "diff-ratio",
        description: `${item.id}: ${(ratio * 100).toFixed(2)} %`,
      });
      console.log(`[visual] ${item.id} light: ${(ratio * 100).toFixed(2)} %`);
      writeFileSync(info.outputPath("actual.png"), PNG.sync.write(actual));
      if (ratio > MAX_DIFF_RATIO) {
        writeFileSync(info.outputPath("diff.png"), PNG.sync.write(diff));
        await info.attach("diff", { path: info.outputPath("diff.png") });
      }
      expect(ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
    });
  }

  // Dark (and light screens Figma does not draw): own committed baseline.
  for (const theme of item.figma ? (["dark"] as const) : THEMES) {
    test(`${item.id} ${theme} matches baseline`, async ({ page }) => {
      await open(page, item, theme);
      await expect(page).toHaveScreenshot(`${item.id}-${theme}.png`, {
        animations: "disabled",
        maxDiffPixelRatio: BASELINE_MAX_DIFF_RATIO,
      });
    });
  }
}
