# Figma snapshot: Keeplas · App Design (pixel-perfect)

A frozen copy of the Figma file, so the v2 context survives without Figma access.

- **File**: https://www.figma.com/design/pzH8HSOAC5KQzFtK0j8ApE/
- **Snapshot**: 2026-10-11, file last modified 2026-10-11T11:47:31Z
- **Source file**: [`source/keeplas-app-design.fig`](source/keeplas-app-design.fig), the full .fig export (2026-10-11). Opens in Figma (drag and drop) and works offline.
- **Re-export**: Figma REST API (`GET /v1/files/:key/nodes`, `GET /v1/images/:key`) with a personal access token. Keep the token out of the repo. SVGs can also be regenerated offline from the .fig with [`tools/fig-to-svg.mjs`](tools/fig-to-svg.mjs).

If this snapshot and Figma disagree, Figma wins for visuals and [`../README.md`](../README.md) wins for product decisions.

## Contents

| Path                         | What it is                                                                                                                                                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`SCREENS.md`](SCREENS.md)   | Every page, section and screen, with node id, size, Figma link and PNG link                                                                                                                                                                                       |
| [`copy.md`](copy.md)         | All text layers of every screen (EN copy source until i18n keys exist)                                                                                                                                                                                            |
| [`tokens.json`](tokens.json) | Values from the Foundations page: light + dark (Noir) primitives and semantic tokens, type scale, spacing, radius                                                                                                                                                 |
| `screens/`                   | PNG export (scale 1) of the 88 screens, 7 landing frames and Foundations                                                                                                                                                                                          |
| `specs/`                     | One JSON per screen: node tree with auto-layout (direction, gap, padding, alignment, sizing), box (x/y/w/h relative to the screen), fills, strokes, effects, radius, text style, component instances and bound variables. **Build from these, not from the PNGs** |
| `svg/`                       | **Code-ready SVGs extracted from the .fig**: 18 illustrations + 2 logos (see below)                                                                                                                                                                               |
| `source/`                    | The original `.fig` file                                                                                                                                                                                                                                          |
| `tools/`                     | `fig-to-svg.mjs`: offline .fig → SVG extractor                                                                                                                                                                                                                    |
| `images/`                    | Raster fill of M08-1 Welcome: `landscape-painted.jpg` (1848×1092, AI-upscaled ×3) and `landscape-painted-original.jpg` (616×364, the only source in the .fig)                                                                                                     |

## SVG assets

All SVGs below were extracted from the .fig with `tools/fig-to-svg.mjs` and checked by rendering them against the Figma screens (e.g. `desktop-landscape` vs W04-1).

| Asset                         | Use in code                                      | Notes                                                                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Icons (58)**                | `../design-kit/svg/icons/`                       | Same 58 names as the Figma `icon/*` components. Kit files are 24 px with `stroke="currentColor"`, so they theme for light and dark. Figma stores outlined strokes, so don't use those in code                                                                                    |
| **Logos (2)**                 | `svg/logo/mark.svg`, `svg/logo/mark-inverse.svg` | Figma `Logo/Mark` and `Logo/Mark Inverse`. The wordmark versions are in `../design-kit/svg/logo/`                                                                                                                                                                                |
| **App illustrations (15)**    | `svg/illustrations/`                             | `landscape`, `landscape-night`, `branch`, `face`, `fingerprint`, `vault-laptop`, `vault-phone`, `invitation`, `scheduled-access`, `browser-linked`, `new-device`, `verification-call`, `desktop-landscape`, `desktop-landscape-night`, `desktop-modal-crest`                     |
| **Landing illustrations (3)** | `svg/illustrations/web-*`                        | `web-video-poster`, `web-family-lake`, `web-floating-docs` (landing page is out of the current plan)                                                                                                                                                                             |
| **Painted landscape**         | `images/landscape-painted.jpg`                   | Raster, M08-1 Welcome, shown at 393×232 pt (@3x = 1179×696 px). No higher-resolution source exists, so it was upscaled ×3 with Real-ESRGAN (`realesr-animevideov3`, picked over `x4plus` / `x4plus-anime`, which invented shapes in the pines). Covers 430 pt wide phones at @3x |

Figma files take precedence over the kit's older SVG names (`landscape-hero`, `branch-decoration`, `biometric-face`, `biometric-fingerprint`).

## File structure

| Page         | Contents                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundations  | Colour primitives, semantic tokens (Light and Dark · Noir), typography, spacing and radius, screen index                                                                                                                                                                                              |
| Components   | 58 icons, logo (light / inverse), 15 illustrations (incl. night and desktop variants), Status Bar, App Header, Button, Callout, List Row, Status Chip, Stepper, Phone Input, OTP Box, Toggle, Checkbox, Radio, Progress Bar, Tab Bar, FAB / Add, Add menu, Language Segment / Dropdown, State Message |
| Screens      | 11 sections, 88 screens (below)                                                                                                                                                                                                                                                                       |
| Landing page | L-01 to L-06 + L-01b. **Out of the current plan.**                                                                                                                                                                                                                                                    |

| Section                                                 | Screens                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| 01 · Mobile setup                                       | M01-1 → M01-6                                               |
| 08 · Home, unlock and security                          | M08-1 → M08-7 (M08-7 Settings is new vs the design kit)     |
| 02 · Recovery and life check                            | M02-1 → M02-6                                               |
| 03 · Shared vault and QR                                | M03-1 → M03-6                                               |
| 06 · People and sharing                                 | M06-1 → M06-6                                               |
| 07 · Capture and devices                                | M07-1 → M07-9 (M07-7 → M07-9 notes and attachments are new) |
| 04 · Web app (sign-in, linking, dashboard)              | W04-1, W04-2, D-01 Get the app, W04-3, W04-3b               |
| 04/05 · Web app (shared, recovery, devices, life check) | W04-4, W04-5, W04-6, W05-3, W05-4, W04-7 Settings           |
| 09 · Security edge cases (A)                            | M09-1 → M09-10                                              |
| 10 · States from one template (B)                       | 22 states built on the `State Message` component            |
| 11 · Dark mode (Noir)                                   | 5 reference screens: M08-3, M08-4, M08-5, M08-6, M08-7      |

W05-1 / W05-2 (web sign-up) were removed on purpose: sign-up is mobile-only.

## Dark mode

Only 5 screens are drawn in dark, **on purpose**. Every other screen, mobile and web, is built by binding the same semantic token names to the `Semantic · Dark` values in `tokens.json`. There is no per-screen dark design. Surfaces step up in grey, thin borders replace shadows, and primary actions invert to cream (`action/primary` = `#F2EFEA`).

## Known mismatches with the decisions (fix in code; update Figma too if it stays the reference)

| Screen                                  | Figma says                                                    | Decision                                                     |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| M02-2, W04-5                            | "48-hour protection window", "36h left", "36 hours remaining" | 72 h everywhere                                              |
| M02-2, M02-3, Foundations "Code" sample | 4-digit code `4729`                                           | 6-digit code                                                 |
| M02-6, W05-4 (FR)                       | "Personnes", "Vérification de vie"                            | "Contacts", "Life check" (kept in English)                   |
| M07-6                                   | Backups "Off by default"                                      | On by default, explained in onboarding with a visible toggle |
