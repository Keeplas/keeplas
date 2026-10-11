# Keeplas design kit

Everything needed before building the app: brand, tokens, icons, illustrations, screen inventory, business rules, EN/FR copy and an architecture review of the Keeplas repo.

Start with **Keeplas-Explorer.html**: global search, the 46 screens cut one by one, clickable flows, icons and colours to copy, tokens to download, architecture and security review, open decisions to tick. **Keeplas-Brand-Guide.html** is the same brand content as a single document.

## Contents

| Folder                     | Contents                                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `Keeplas-Explorer.html`    | Interactive explorer (works offline except Google Fonts)                                                                                 |
| `Keeplas-Brand-Guide.html` | Full brand guide as one document                                                                                                         |
| `tokens/`                  | `tokens.json` (W3C format), `tokens.css`, `tailwind.preset.js` (web / NativeWind), `theme.ts` (Expo)                                     |
| `svg/logo/`                | Symbol and logo, light and inverse                                                                                                       |
| `svg/icons/`               | 58 stroke icons, 24 px, `stroke="currentColor"`                                                                                          |
| `svg/illustrations/`       | 11 vector illustrations in the mockup style                                                                                              |
| `mockups/`                 | The 8 original boards, renamed                                                                                                           |
| `docs/`                    | `SCREENS.md`, `FLOWS.md`, `BUSINESS-RULES.md`, `OPEN-DECISIONS.md`, `ARCHITECTURE.md`, `convex-schema-additions.ts`, `device-sqlite.sql` |
| `i18n/`                    | `config.json` (English default, English fallback), `en.json`, `fr.json`                                                                  |

## Language

English is the default language, including on first launch. French is an option chosen by the user and saved on the account. Any key missing in French falls back to English.

## Fonts

- Headings: **Source Serif 4** SemiBold (Google Fonts, OFL)
- Interface: **Inter** Regular / Medium / SemiBold (Google Fonts, OFL)

On mobile, load both with `expo-font`. The mockups' serif cannot be identified with certainty; Source Serif 4 is very close and free to use.

## Notes

- The Chrome logo and portraits from the mockups are not reused: generic browser icon and initials avatars instead.
- The SVG illustrations follow the same world (mountains, pines, lake, sun, foliage) with simplified shapes. For a pixel-identical look, have an illustrator rework the PNGs.
