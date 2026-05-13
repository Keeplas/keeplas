---
description: Enforce the Keeplas design system ("The Digital Curator") when building or modifying UI components and pages. Use this skill for any UI work.
user_invocable: true
---

# Keeplas Design System — "The Digital Curator"

High-end editorial experience. The UI is a bespoke private gallery — not a dashboard.
Authority is achieved through massive typographic contrasts and layered surfaces, never decorative borders.

## Required Imports

Always use `@keeplas/ui` components. Never create custom interactive elements outside `packages/ui/src/`.

```tsx
import { Button, Card, Input, Dialog, ... } from "@keeplas/ui";
```

Check `packages/ui/src/index.ts` for all available exports before creating anything new.

## Color Tokens

Defined as CSS variables in `apps/web/src/app/globals.css` → `@theme inline {}`.
Use directly as Tailwind classes: `bg-primary`, `text-on-surface`, `bg-surface-container-low`, etc.

### Primary — Vault Navy

| Token                          | Hex     | Tailwind class                |
| ------------------------------ | ------- | ----------------------------- |
| `--color-primary`              | #041632 | `bg-primary` / `text-primary` |
| `--color-primary-container`    | #1b2b48 | `bg-primary-container`        |
| `--color-primary-fixed`        | #d4e3ff | `bg-primary-fixed`            |
| `--color-primary-fixed-dim`    | #a4c4f0 | `bg-primary-fixed-dim`        |
| `--color-on-primary`           | #ffffff | `text-on-primary`             |
| `--color-on-primary-container` | #b8cfe8 | `text-on-primary-container`   |

### Secondary — Reassurance Teal

| Token                            | Hex     | Tailwind class                    |
| -------------------------------- | ------- | --------------------------------- |
| `--color-secondary`              | #28657a | `bg-secondary` / `text-secondary` |
| `--color-secondary-container`    | #3a7d91 | `bg-secondary-container`          |
| `--color-secondary-fixed`        | #b9eaff | `bg-secondary-fixed`              |
| `--color-secondary-fixed-dim`    | #8ec8d8 | `bg-secondary-fixed-dim`          |
| `--color-on-secondary`           | #ffffff | `text-on-secondary`               |
| `--color-on-secondary-container` | #c5e4ed | `text-on-secondary-container`     |

### Tertiary — Deep Shadow

| Token                        | Hex     | Tailwind class          |
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

### Error

| Token                     | Hex     | Tailwind class            |
| ------------------------- | ------- | ------------------------- |
| `--color-error`           | #ba1a1a | `bg-error` / `text-error` |
| `--color-error-container` | #ffdad6 | `bg-error-container`      |
| `--color-on-error`        | #ffffff | `text-on-error`           |

### Outline

| Token                     | Hex     | Tailwind class           |
| ------------------------- | ------- | ------------------------ |
| `--color-outline`         | #7b7674 | `border-outline`         |
| `--color-outline-variant` | #c5c6ce | `border-outline-variant` |

## Typography

### Fonts

- **Manrope** (`font-headline`): Display text, headlines, section headers
- **Inter** (`font-sans` / `font-body` / `font-label`): Body text, labels, metadata

### Scale (custom @utility classes)

| Class              | Font    | Size     | Weight | Tracking          | Use                            |
| ------------------ | ------- | -------- | ------ | ----------------- | ------------------------------ |
| `text-display-lg`  | Manrope | 3.5rem   | 700    | -0.02em           | Hero moments                   |
| `text-display-md`  | Manrope | 2.75rem  | 700    | -0.02em           | Secondary heroes               |
| `text-headline-lg` | Manrope | 2rem     | 600    | -0.01em           | Section headers                |
| `text-headline-md` | Manrope | 1.5rem   | 600    | —                 | Sub-section headers            |
| `text-body-lg`     | Inter   | 1rem     | 400    | —                 | Primary body (line-height 1.6) |
| `text-body-md`     | Inter   | 0.875rem | 400    | —                 | Secondary body                 |
| `text-label-lg`    | Inter   | 0.875rem | 500    | —                 | Form labels                    |
| `text-label-md`    | Inter   | 0.75rem  | 500    | 0.05em, uppercase | Metadata, "stamped" labels     |

## Design Rules

### The "No-Line" Rule

- **NEVER** use `border`, `border-t`, `border-b`, `divide-y`, or any 1px solid borders
- Boundaries come ONLY from background color shifts between surface tiers
- The ONLY allowed border: `ghost-border` utility (outline-variant at 15% opacity) for high-density data edge cases
- If a line feels necessary → increase white space or tonal contrast instead

### Tonal Layering over Shadows

- Depth = background color shifts between surface tiers
- Ambient shadows: 24-32px blur at 6% opacity, tinted with `on-surface` (#1d1b1a), never pure black
- Never use `shadow-md` or `shadow-lg` with default Tailwind shadow colors

### Glassmorphism (floating elements only)

- `glass` utility: dark floating elements (nav bars, dark toasts)
- `glass-light` utility: light floating elements (popovers, light toasts)
- Apply to: nav bars, floating action buttons, toasts, overlays

### Signature Gradient

- `gradient-signature` / `vault-gradient`: `linear-gradient(135deg, #041632 → #1b2b48)`
- Use for: primary CTA buttons, hero sections, accent blocks

## Component Patterns

### Buttons

- **Primary**: `gradient-signature`, `text-on-primary`, `rounded-xl`
- **Vault** (hero CTA): `vault-gradient`, `font-headline`, `font-bold`, shadow + scale hover
- **Secondary**: no background, `text-secondary`, hover `bg-surface-container`
- **Ghost**: no background, `text-on-surface`, hover `bg-surface-container`
- **Destructive**: `bg-error`, `text-on-error`

### Inputs

- Background: `bg-surface-container-low`, transparent border, `rounded-xl`
- Focus: `bg-surface-container-high` + `border-secondary/15`
- No "box" look — fields blend into the surface

### Cards

- No divider lines inside cards — use spacing (2rem / 2.5rem gap)
- Default: `bg-surface-container-low`, large radius, `p-6`
- Lists: alternate `bg-surface` and `bg-surface-container-low`

### Legacy Card (vital/pinned items)

- `bg-primary-container`, `text-on-primary-container`
- High-contrast anchor block for critical information

## Spacing & Layout

- Generous spacing: `gap-8` (2rem) or `gap-10` (2.5rem) between sections
- Asymmetric layouts encouraged (left-aligned headline, right-aligned body)
- When content feels tight → increase spacing, never add borders

## Border Radius Scale

| Token          | Value    | Use                        |
| -------------- | -------- | -------------------------- |
| `rounded`      | 0.125rem | Subtle elements            |
| `rounded-lg`   | 0.25rem  | Small interactive elements |
| `rounded-xl`   | 0.5rem   | Inputs, secondary buttons  |
| `rounded-full` | 0.75rem  | Cards, primary containers  |

## Don'ts

- No 100% opaque borders (use `ghost-border` if absolutely needed)
- No default Tailwind colors (`blue-500`, `gray-200`, etc.) — always use design tokens
- No standard "Success Green" or "Warning Orange" — use `secondary-fixed` for success/highlights
- No crowded interfaces — increase spacing scale
- No custom interactive elements outside `packages/ui/`
- No `shadow-md`/`shadow-lg` with default Tailwind shadows

## Reference Files

- Design guidelines: `PRD/Design/design-guidelines.md`
- Wireframes: `PRD/Design/wireframes-1.md`, `PRD/Design/wireframes-2.md`
- CSS tokens: `apps/web/src/app/globals.css`
- UI components: `packages/ui/src/`
- Component exports: `packages/ui/src/index.ts`
