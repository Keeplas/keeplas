---
name: design-system
description: Enforce the Keeplas design system ("The Digital Curator") for any UI work — building or editing components and pages. Covers color tokens, surface tonal layering, typography scale, the no-border rule, button/input/card patterns, and the @keeplas/ui component library. Use whenever you touch .tsx UI, styling, or layout.
---

# Keeplas Design System — "The Digital Curator"

High-end editorial experience. The UI is a bespoke private gallery — not a dashboard.
Authority comes from massive typographic contrast and layered surfaces, **never decorative borders**.

When doing any UI work in this repo, follow this skill. If a wireframe exists in `PRD/Design/`, it wins over generic guidance here.

## Required Imports

Always use `@keeplas/ui` components. Never create custom interactive elements outside `packages/ui/src/`.

```tsx
import { Button, Card, Input, Dialog } from "@keeplas/ui";
import { cn } from "@/lib/utils"; // re-exported from @keeplas/ui
```

Available exports (from `packages/ui/src/index.ts` — grep it before creating anything new):

`Avatar` · `Badge` · `Button` · `Calendar` · `DatePicker` · `Card` (+ Header/Title/Description/Content/Footer) · `Dialog` (+ parts) · `ConfirmDialogProvider`/`useConfirm` · `DropdownMenu` · `Popover` · `Command` · `ErrorAlert` · `Icon` · `Input` · `Label` · `LegacyCard` · `PasswordInput` · `PhoneInput` · `Progress` · `Select` · `Separator` · `Sheet` · `Switch` · `Tabs` · `Spinner` · `Loader` · `Textarea` · `Toast`/`Toaster`/`toast`/`useToast` · `Tooltip` · `UserAvatar` · `RichTextEditor` · `HelpHint` · `InfoCallout` · helpers `isValidEmail`, `isValidPhone`, `normalizePhone`, `cn`

## Color Tokens

CSS variables in `apps/web/src/app/globals.css` → `@theme inline {}`. Use directly as Tailwind classes (`bg-primary`, `text-on-surface`, `bg-surface-container-low`). **Never** use default Tailwind colors (`blue-500`, `gray-200`).

### Primary — Vault Navy

| Token                          | Hex     | Class                         |
| ------------------------------ | ------- | ----------------------------- |
| `--color-primary`              | #041632 | `bg-primary` / `text-primary` |
| `--color-primary-container`    | #1b2b48 | `bg-primary-container`        |
| `--color-primary-fixed`        | #d4e3ff | `bg-primary-fixed`            |
| `--color-primary-fixed-dim`    | #a4c4f0 | `bg-primary-fixed-dim`        |
| `--color-on-primary`           | #ffffff | `text-on-primary`             |
| `--color-on-primary-container` | #b8cfe8 | `text-on-primary-container`   |

### Secondary — Reassurance Teal

| Token                            | Hex     | Class                                    |
| -------------------------------- | ------- | ---------------------------------------- |
| `--color-secondary`              | #28657a | `bg-secondary` / `text-secondary`        |
| `--color-secondary-container`    | #3a7d91 | `bg-secondary-container`                 |
| `--color-secondary-fixed`        | #b9eaff | `bg-secondary-fixed` (success/highlight) |
| `--color-on-secondary`           | #ffffff | `text-on-secondary`                      |
| `--color-on-secondary-container` | #c5e4ed | `text-on-secondary-container`            |

### Tertiary — Deep Shadow

| Token                        | Hex     | Class                   |
| ---------------------------- | ------- | ----------------------- |
| `--color-tertiary`           | #001a20 | `bg-tertiary`           |
| `--color-tertiary-container` | #0a2e38 | `bg-tertiary-container` |

### Surface Hierarchy (tonal layering — NO borders)

| Level | Token                       | Hex     | Use                          |
| ----- | --------------------------- | ------- | ---------------------------- |
| Base  | `surface`                   | #fcf9f8 | Page background              |
| L1    | `surface-container-low`     | #f6f3f2 | Secondary content blocks     |
| L2    | `surface-container`         | #f0eded | Primary interactive cards    |
| L3    | `surface-container-high`    | #eae7e7 | Focused inputs, hover states |
| L4    | `surface-container-highest` | #e5e2e1 | Modals, popovers             |
| Float | `surface-container-lowest`  | #ffffff | Cards that need to "float"   |

### Error & Outline

| Token                     | Hex     | Class                     |
| ------------------------- | ------- | ------------------------- |
| `--color-error`           | #ba1a1a | `bg-error` / `text-error` |
| `--color-error-container` | #ffdad6 | `bg-error-container`      |
| `--color-on-error`        | #ffffff | `text-on-error`           |
| `--color-outline`         | #7b7674 | `border-outline`          |
| `--color-outline-variant` | #c5c6ce | `border-outline-variant`  |

## Typography

- **Manrope** (`font-headline`): display text, headlines, section headers
- **Inter** (`font-sans` / `font-body` / `font-label`): body, labels, metadata

| Class              | Font    | Size     | Tracking          | Use                            |
| ------------------ | ------- | -------- | ----------------- | ------------------------------ |
| `text-display-lg`  | Manrope | 3.5rem   | -0.02em           | Hero moments                   |
| `text-display-md`  | Manrope | 2.75rem  | -0.02em           | Secondary heroes               |
| `text-headline-lg` | Manrope | 2rem     | -0.01em           | Section headers                |
| `text-headline-md` | Manrope | 1.5rem   | —                 | Sub-section headers            |
| `text-body-lg`     | Inter   | 1rem     | —                 | Primary body (line-height 1.6) |
| `text-body-md`     | Inter   | 0.875rem | —                 | Secondary body                 |
| `text-label-lg`    | Inter   | 0.875rem | —                 | Form labels                    |
| `text-label-md`    | Inter   | 0.75rem  | 0.05em, uppercase | Metadata, "stamped" labels     |

## Design Rules

### The "No-Line" Rule

- **NEVER** use `border`, `border-t/b`, `divide-y`, or any 1px solid border to section content.
- Boundaries come ONLY from background color shifts between surface tiers.
- Only allowed border: the `ghost-border` utility (outline-variant at 15% opacity) for high-density data edge cases.
- If a line feels necessary → add white space or tonal contrast instead.

### Tonal Layering over Shadows

- Depth = background shifts between surface tiers (recessed card = lower tier on higher tier).
- Ambient shadow only when floating: 24–32px blur at ~6% opacity, tinted with `on-surface` (#1d1b1a), never pure black.
- Avoid `shadow-md`/`shadow-lg` with default Tailwind shadow colors.

### Signature Utilities (in globals.css)

- `gradient-signature` / `vault-gradient`: `linear-gradient(135deg, #041632 → #1b2b48)` — primary CTAs, hero, accent blocks.
- `glass`: dark floating elements (nav bars, dark toasts). `glass-light`: light floating elements (popovers, light toasts).
- `ghost-border`: the only sanctioned border.

## Component Patterns

### Buttons (`<Button variant size>`)

Real variants from `button.tsx` — pass via props, don't restyle:

| `variant`     | Style                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `default`     | `gradient-signature` + `text-on-primary`, `shadow-sm` (standard CTA)   |
| `vault`       | `vault-gradient` + `font-headline font-bold`, lift on hover (hero CTA) |
| `secondary`   | transparent, `text-secondary`, hover `bg-surface-container`            |
| `outline`     | `ghost-border`, `text-on-surface`, hover `bg-surface-container-high`   |
| `ghost`       | transparent, `text-on-surface`, hover `bg-surface-container`           |
| `destructive` | `bg-error`, `text-on-error`                                            |

Sizes: `sm` (h-9), `md` (h-11, default), `lg` (h-13, `rounded-full`), `xl` (h-14), `icon` (10×10). Default = `default`/`md`.

### Inputs

- Background `bg-surface-container-low`, transparent border, large radius. No "box" look — fields blend into the surface.
- Focus: `bg-surface-container-high` + `border-secondary/15`.

### Cards & Lists

- No divider lines inside cards — separate with spacing (`gap-8` / `gap-10`).
- Default card: `bg-surface-container-low`, large radius, `p-6`.
- High-density lists: alternate `bg-surface` and `bg-surface-container-low`.

### Legacy Card (vital / pinned items)

- Use `<LegacyCard>` — `bg-primary-container` + `text-on-primary-container`. High-contrast anchor for critical info.

## Spacing & Layout

- Generous spacing: `gap-8` (2rem) or `gap-10` (2.5rem) between sections.
- Asymmetric layouts encouraged (left-aligned headline, right-aligned body block).
- Content feels tight → step up the spacing scale, never add a border.

## Border Radius Scale

| Class          | Value    | Use                                     |
| -------------- | -------- | --------------------------------------- |
| `rounded`      | 0.125rem | Subtle elements                         |
| `rounded-lg`   | 0.25rem  | Small interactive elements              |
| `rounded-xl`   | 0.5rem   | Inputs, most buttons                    |
| `rounded-full` | 0.75rem  | Cards, primary containers, `lg` buttons |

## Don'ts

- No 100% opaque borders (use `ghost-border` only if unavoidable).
- No default Tailwind colors — always design tokens.
- No "Success Green" / "Warning Orange" — use `secondary-fixed` for success/highlight, `error` for danger.
- No crowded interfaces — increase spacing.
- No custom interactive elements outside `packages/ui/`.
- No `shadow-md`/`shadow-lg` with default Tailwind shadow colors.

## Reference Files

- Guidelines: `PRD/Design/design-guidelines.md`
- Wireframes: `PRD/Design/wireframes-1.md`, `PRD/Design/wireframes-2.md`
- CSS tokens: `apps/web/src/app/globals.css` (`@theme inline`)
- Components + exports: `packages/ui/src/` · `packages/ui/src/index.ts`
