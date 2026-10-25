import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const FIGMA_SCREENS = fileURLToPath(
  new URL("../../../PRD/v2-mobile-first/figma/screens/", import.meta.url),
);

/**
 * Agreed threshold for light screens vs Figma: at most 3 % of pixels may
 * differ, a pixel counting as different when its YIQ color distance exceeds
 * 0.1 (pixelmatch `threshold`), anti-aliased pixels ignored. Browser text
 * rasterization never matches Figma's exactly, so a few percent of glyph
 * edges always differ even on a faithful build; layout or color mistakes
 * show up well above that.
 */
const MAX_DIFF_RATIO = 0.03;
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

// The dialog focuses its only action on open (keyboard users); Figma draws
// it at rest.
const blurAutoFocus = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

// The dashboard follows the mobile Home (recovery health row, upgrade card),
// not the Figma W04-3 "Required setup" card, so the screens drawn on it are
// checked against their own baselines.
const CASES: Case[] = [
  { id: "W04-3", figma: null, ...SHELL },
  {
    id: "W04-3b",
    figma: null,
    ...SHELL,
    // Figma draws the first entry highlighted.
    prepare: (page) => page.keyboard.press("ArrowDown"),
  },
  { id: "W04-3-empty", figma: null, ...SHELL },
  {
    id: "W04-5",
    figma: "W04-5_Recovery_center_status_only_.png",
    ...SHELL,
  },
  { id: "W04-6", figma: "W04-6_Sessions_and_security.png", ...SHELL },
  { id: "W04-7", figma: "W04-7_Settings.png", ...SHELL },
  { id: "W04-7-plan", figma: null, ...SHELL },
  {
    id: "W05-3",
    figma: "W05-3_Life_check_modal_EN_.png",
    ...SHELL,
    prepare: blurAutoFocus,
  },
  {
    id: "W05-4",
    figma: "W05-4_Life_check_modal_FR_.png",
    ...SHELL,
    lang: "fr",
    prepare: blurAutoFocus,
  },
  {
    id: "W06-1",
    figma: "W06-1_My_vault_Documents_list_.png",
    ...SHELL,
    // Figma draws the first row hovered.
    prepare: (page) =>
      page.getByRole("link", { name: "Home insurance policy.pdf" }).hover(),
  },
  {
    id: "W06-2",
    figma: "W06-2_Document_viewer_preview_details_.png",
    ...SHELL,
  },
  {
    id: "W06-3",
    figma: "W06-3_Add_a_document_upload_modal_.png",
    ...SHELL,
    prepare: blurAutoFocus,
  },
  {
    id: "W06-4",
    figma: null,
    ...SHELL,
    prepare: blurAutoFocus,
  },
  { id: "W06-5", figma: "W06-5_New_note_with_attachments.png", ...SHELL },
  {
    id: "W06-6",
    figma: "W06-6_Record_a_voice_note.png",
    ...SHELL,
    prepare: blurAutoFocus,
  },
  {
    id: "W06-7",
    figma: null,
    ...SHELL,
    prepare: blurAutoFocus,
  },
  { id: "W06-8", figma: "W06-8_Photo_preview.png", ...SHELL },
  { id: "W06-9", figma: "W06-9_Video_preview.png", ...SHELL },
  // Section 10 states that apply to the web (393 px State Message cards).
  {
    id: "state-vault-empty",
    figma: "Empty_states_Your_vault_is_empty.png",
    width: 393,
    height: 350,
  },
  {
    id: "state-nothing-shared",
    figma: "Empty_states_Nothing_shared_with_you_yet.png",
    width: 393,
    height: 286,
  },
  {
    id: "state-we-missed-you",
    figma: "Life_check_We_missed_you.png",
    width: 393,
    height: 350,
  },
  {
    id: "state-no-contacts",
    figma: "Empty_states_No_trusted_contacts_yet.png",
    width: 393,
    height: 350,
  },
  {
    id: "state-travel-mode",
    figma: "Life_check_Travel_mode_is_on.png",
    width: 393,
    height: 386,
  },
  {
    id: "state-offline",
    figma: "Offline_and_upload_You_re_offline.png",
    width: 393,
    height: 350,
  },
  {
    id: "state-upload-failed",
    figma: "Offline_and_upload_Upload_failed.png",
    width: 393,
    height: 386,
  },
  {
    id: "state-storage-full",
    figma: "Offline_and_upload_Your_100_MB_are_full.png",
    width: 393,
    height: 386,
  },
  {
    id: "state-camera-off",
    figma: "Permissions_Camera_access_is_off.png",
    width: 393,
    height: 386,
  },
  {
    id: "state-microphone-off",
    figma: "Permissions_Microphone_access_is_off.png",
    width: 393,
    height: 364,
  },
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
      writeFileSync(info.outputPath("diff.png"), PNG.sync.write(diff));
      if (ratio > MAX_DIFF_RATIO) {
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
