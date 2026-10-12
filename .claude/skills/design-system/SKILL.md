---
name: design-system
description: Enforce the Keeplas design system v2 for any UI work — building or editing components and pages. Covers light + dark (Noir) semantic color tokens, the Source Serif 4 + Inter type scale, radius and spacing, icons, illustrations and logos, legacy-token rules, and the @keeplas/ui component library. Use whenever you touch .tsx UI, styling, or layout.
---

# Keeplas Design System v2

Calm, editorial, trustworthy: navy on warm ivory, a serif for headings, landscape illustrations, thin borders allowed. Light and dark (Noir).

Sources, in order of authority:

1. Product decisions: `PRD/v2-mobile-first/README.md`
2. Visuals: Figma `pzH8HSOAC5KQzFtK0j8ApE`, snapshot in `PRD/v2-mobile-first/figma/` — `tokens.json` (Foundations), `specs/<screen>.json` (layout values: gap, padding, radius, fills), `screens/*.png`
3. This skill

`PRD/Design/` ("Digital Curator", Manrope, `#041632`, no-border rule) is **superseded**. Don't follow it.

## Required imports

Always use `@keeplas/ui` components. Never create custom interactive elements outside `packages/ui/src/`.

```tsx
import { Button, Card, Input, Dialog } from "@keeplas/ui";
import { cn } from "@/lib/utils"; // re-exported from @keeplas/ui
```

Available exports (from `packages/ui/src/index.ts` — grep it before creating anything new):

`Avatar` · `Badge` · `Button` (v2: `variant="primary" | "outlined" | "link" | "danger"`, `size="cta" | "compact"`; the other variants are legacy) · `Calendar` · `Checkbox` · `DatePicker` · `Card` (+ Header/Title/Description/Content/Footer) · `Dialog` (+ parts) · `ConfirmDialogProvider`/`useConfirm` · `DropdownMenu` · `Popover` · `Command` · `ErrorAlert` · `Icon` · `Input` · `Label` · `LegacyCard` · `PhoneInput` · `Progress` · `Select` · `Separator` · `Sheet` · `Switch` · `Tabs` · `Spinner` · `Loader` / `KeeplasLogoMark` · `Textarea` · `Toast`/`Toaster`/`toast`/`useToast` · `Tooltip` · `UserAvatar` · `RichTextEditor` · `HelpHint` · `InfoCallout` · helpers `isValidEmail`, `isValidPhone`, `normalizePhone`, `cn`

## Color tokens

Defined in `apps/web/src/app/globals.css`: primitives and semantic tokens as `--kp-*` CSS variables (`:root` = light, `.dark` = Noir), semantic ones exposed to Tailwind in `@theme inline`. Names mirror Figma: `bg/app` → `--kp-bg-app` → class `bg-bg-app`. `src/app/__tests__/design-tokens.test.ts` keeps them equal to `figma/tokens.json`.

**New code uses semantic tokens only.** They switch for dark mode automatically, so never add `dark:` color overrides and never write hex values.

| Figma token                                          | Class                                                   | Light → Dark             |
| ---------------------------------------------------- | ------------------------------------------------------- | ------------------------ |
| `bg/app`                                             | `bg-bg-app`                                             | `#FDFBF7` → `#0A0A0B`    |
| `bg/surface`                                         | `bg-bg-surface`                                         | `#FFFFFF` → `#141416`    |
| `bg/subtle`                                          | `bg-bg-subtle`                                          | `#F7F4EE` → `#1C1C1F`    |
| `bg/info`                                            | `bg-bg-info`                                            | `#EEF5FA` → `#1A2233`    |
| `bg/warm`                                            | `bg-bg-warm`                                            | `#F6EFE9` → `#1C1C1F`    |
| `bg/header`                                          | `bg-bg-header`                                          | `#0E2340` → `#000000`    |
| `text/primary`                                       | `text-text-primary`                                     | `#0E2340` → `#F2EFEA`    |
| `text/body`                                          | `text-text-body`                                        | `#3A4A60` → `#C9C6C0`    |
| `text/muted`                                         | `text-text-muted`                                       | `#5E6E83` → `#8E8E93`    |
| `text/subtle`                                        | `text-text-subtle`                                      | `#8A97A8` → `#5A5A60`    |
| `text/inverse`                                       | `text-text-inverse` (on `bg-header` / `action-primary`) | `#FFFFFF` → `#0A0A0B`    |
| `text/link`                                          | `text-text-link`                                        | `#102844` → `#A9C1E8`    |
| `border/default`                                     | `border-border-default`                                 | `#E3E7EC` → `#26262A`    |
| `border/strong`                                      | `border-border-strong`                                  | `#C5D7E8` → `#3A3A40`    |
| `border/focus`                                       | `ring-border-focus` / `border-border-focus`             | `#238BCA` → `#4FA8E0`    |
| `action/primary`, `action/primary-hover`             | `bg-action-primary hover:bg-action-primary-hover`       | navy → cream (`#F2EFEA`) |
| `action/danger`                                      | `bg-action-danger` / `text-action-danger`               | `#D92D35` → `#F0565C`    |
| `status/active`, `/pending`, `/revoked`              | `text-status-active` …                                  | green / amber / red      |
| `progress/track`, `progress/fill`                    | `bg-progress-track`, `bg-progress-fill`                 | `#DCE8F2`, sky           |
| `category/{document,account,instruction,other,note}` | `bg-category-document` … (same in both themes)          | —                        |

Web extensions (not in Foundations; colors the W04 / W05 frames paint from primitives, each with a Noir value): `text-header-text` / `text-header-text-muted` (sidebar), `text-icon-default`, `text-icon-subtle` (chevrons, more), `bg-bg-accent` + `text-text-accent` (sky tiles, permission chip), `bg-bg-danger`, `bg-bg-pending` + `text-text-pending` (status chips, alerts), `bg-scrim` (modal overlay), `shadow-menu`.

Primitives (`--kp-navy-*`, `--kp-sky-*`, `--kp-ivory-*`, `--kp-sand-*`, `--kp-dawn-*`, `--kp-noir-*` …) exist as CSS variables only; reach for them in CSS, not in components.

### Dark mode (Noir)

`.dark` on `<html>` switches every semantic token (`@custom-variant dark` = `.dark`). Only 5 screens are drawn dark in Figma, on purpose: every screen binds to the semantic tokens and gets dark for free. Surfaces step up in grey, thin borders replace shadows, primary actions invert to cream. The account menu toggles `.dark` (`src/lib/theme.ts`, saved per browser, light by default while legacy screens remain).

### Legacy names (existing screens only)

The old Material names (`bg-primary`, `bg-surface-container-low`, `text-on-surface-variant`, `text-secondary`, `bg-error-container`, `ghost-border`, `vault-gradient` …) still exist, re-pointed to v2 values so current screens show the new palette. They are **light-only** and are removed as screens are rebuilt. Don't use them in new code; when you rebuild a screen, replace them with semantic tokens.

## Typography

- **Source Serif 4** SemiBold (`font-serif`): display and headings
- **Inter** (`font-sans`, default): everything else

| Class          | Font / weight      | Size / line height | Use                     |
| -------------- | ------------------ | ------------------ | ----------------------- |
| `text-display` | Source Serif 4 600 | 36 / 40            | Hero titles             |
| `text-h1`      | Source Serif 4 600 | 30 / 34            | Screen titles           |
| `text-h2`      | Source Serif 4 600 | 24 / 30            | Section titles          |
| `text-h3`      | Source Serif 4 600 | 19 / 24            | Card titles             |
| `text-body-lg` | Inter 400          | 17 / 25            | Lead paragraphs         |
| `text-body`    | Inter 400          | 15 / 22            | Body                    |
| `text-label`   | Inter 600          | 15 / 20            | Row titles, form labels |
| `text-body-sm` | Inter 400          | 13 / 18            | Secondary text          |
| `text-caption` | Inter 500          | 12 / 16            | Metadata, chips         |
| `text-code`    | Inter 600, tabular | 34 / 40            | 6-digit recovery code   |
| `text-button`  | Inter 600          | 16 / 20            | Button labels           |

Sizes are in px so they match Figma exactly (the legacy `html { font-size: 85% }` only scales rem-based legacy utilities). Combine freely with colors: `cn("text-h1 text-text-primary")` is safe — `cn` registers this scale with tailwind-merge (`packages/ui/src/lib/utils.ts`). Add any new `text-*` size utility there too.

Legacy scale (`text-headline-*`, `text-body-md`, `text-label-md`, `text-display-lg/md`) remains for existing screens only.

## Radius and spacing

| Class          | Value | Typical use (Figma)            |
| -------------- | ----- | ------------------------------ |
| `rounded-xs`   | 6 px  | Chips, small controls          |
| `rounded-sm`   | 10 px | Inputs, list rows, small cards |
| `rounded-md`   | 14 px | Buttons, cards                 |
| `rounded-lg`   | 20 px | Large cards, sheets            |
| `rounded-xl`   | 28 px | Modals, hero panels            |
| `rounded-full` | pill  | Avatars, pills, FAB            |

Spacing follows a 4 px grid (`--kp-space-1` … `--kp-space-16` = 4 … 64 px). In Tailwind, use the value from `specs/` directly (`gap-[12px]`, `p-[20px]`) or the default scale where it matches; the 85% root makes Tailwind's rem spacing 3.4 px per step, so prefer px for pixel-perfect screens.

## Icons, illustrations, logos

- **Icons**: `<Icon path={ICON_PATHS.lock} />` (`@keeplas/ui` + `apps/web/src/lib/icons.ts`). The 58 kit icons (`PRD/v2-mobile-first/design-kit/svg/icons/`) are in `ICON_PATHS` under camelCase names (`shieldCheck`, `faceId`, `cloudUpload` …), drawn at the default stroke 1.75 with `currentColor`, so they theme. `more` and `pin` are dot grids: pass `strokeWidth={2.6}`. Entries not in the kit are legacy.
- **Illustrations**: `apps/web/public/assets/illustrations/*.svg` (from `figma/svg/illustrations/`): `landscape`, `landscape-night`, `desktop-landscape(-night)`, `desktop-modal-crest`, `branch`, `face`, `fingerprint`, `vault-laptop`, `vault-phone`, `invitation`, `scheduled-access`, `browser-linked`, `new-device`, `verification-call`. Use the `-night` variant in dark mode. Landing illustrations (`web-*`) belong to the keeplas-website repo.
- **Logos**: `/assets/logo/logo.svg` (symbol), `logo-inverse.svg` (on navy / dark), `logo-wordmark.svg`, `favicon.svg`. In React, `KeeplasLogoMark` from `@keeplas/ui` binds to tokens and themes itself.

## Rules

- Thin borders are allowed: 1 px `border-border-default` for cards and rows, `border-border-strong` for inputs. No heavy outlines.
- Depth: light theme may use a soft card shadow (`0 1px 2px rgba(14,35,64,.05), 0 6px 18px rgba(14,35,64,.06)`); dark theme uses borders, not shadows.
- Focus: visible ring in `border-focus` on every interactive element.
- Pixel-perfect: build each component once from `figma/specs/` values bound to tokens. Never paste generated Figma code, never eyeball from PNGs.
- Copy follows the decisions log, not the mockups: 72 h windows, 6-digit codes, "Contacts" and "Life check" (see `PRD/v2-mobile-first/README.md`).
- No default Tailwind palette colors (`blue-500`, `gray-200`) and no hex in components.
- No custom interactive elements outside `packages/ui/`.

## Reference files

- Decisions and phases: `PRD/v2-mobile-first/README.md`
- Figma snapshot: `PRD/v2-mobile-first/figma/README.md`, `SCREENS.md`, `copy.md`, `tokens.json`, `specs/`
- Design kit (brand guide, explorer, flows, business rules): `PRD/v2-mobile-first/design-kit/`
- CSS tokens: `apps/web/src/app/globals.css` · token test: `apps/web/src/app/__tests__/design-tokens.test.ts`
- Components + exports: `packages/ui/src/` · `packages/ui/src/index.ts`
