# Design System Specification: The Architectural Vault

## 1. Overview & Creative North Star: "The Digital Curator"

This design system rejects the "standard dashboard" aesthetic in favor of a **High-End Editorial** experience. The Creative North Star is **The Digital Curator**: a philosophy where the UI feels like a bespoke, private gallery of a life’s most important legacies.

We break the "template" look by utilizing **intentional asymmetry** and **tonal depth**. Instead of rigid, boxed-in grids, we use expansive breathing room and overlapping elements to create a sense of protection and prestige. This is not a file manager; it is a secure sanctuary. The design achieves authority through massive typographic contrasts and layered surfaces rather than decorative borders.

---

## 2. Colors & Surface Philosophy

Our palette moves beyond "standard blue" into a sophisticated spectrum of Deep Navy and Architectural Teal.

### The Palette

- **Primary (`#041632`):** Our "Vault Navy." Use for deep immersion and core brand moments.
- **Secondary (`#28657a`):** The "Reassurance Teal." Used for active states and subtle guidance.
- **Tertiary (`#001a20`):** The "Deep Shadow." Used for high-contrast accents and grounding elements.
- **Surface Tiers:** Use `surface-container-low` (`#f6f3f2`) to `surface-container-highest` (`#e5e2e1`) to build logical hierarchy.

### The "No-Line" Rule

**Explicit Instruction:** Do not use 1px solid borders to section content. Boundaries must be defined solely through background color shifts.

- _Example:_ A `surface-container-low` card sitting on a `surface` background provides all the definition needed. If you feel a line is necessary, you haven't used enough white space or tonal contrast.

### Surface Hierarchy & Nesting

Treat the UI as a series of physical layers—like stacked sheets of fine, heavy-weight paper.

- **Level 0:** `surface` (Base)
- **Level 1:** `surface-container-low` (Secondary content blocks)
- **Level 2:** `surface-container` (Primary interactive cards)
- **Level 3:** `surface-container-highest` (Modals and urgent pop-overs)

### Signature Textures: Glass & Gradients

To avoid a clinical feel, use **Glassmorphism** for floating elements (e.g., navigation bars or floating action buttons). Apply a `backdrop-blur` (20px+) to `surface` colors at 80% opacity.

- **The Signature Gradient:** For primary CTAs, use a subtle linear gradient from `primary` (`#041632`) to `primary-container` (`#1b2b48`) at a 135° angle. This adds a "soulful" depth that flat colors lack.

---

## 3. Typography: Editorial Authority

We pair the geometric precision of **Manrope** for display with the functional clarity of **Inter** for utility.

- **Display (Manrope):** Use `display-lg` (3.5rem) and `display-md` (2.75rem) for hero moments. These should be set with tight letter-spacing (-0.02em) to feel architectural.
- **Headlines (Manrope):** `headline-lg` (2rem) is your standard for section headers. It conveys the "Protective" mood through its weight.
- **Body (Inter):** `body-lg` (1rem) is the workhorse. Ensure a line-height of 1.6 for maximum legibility in sensitive documentation.
- **Labels (Inter):** `label-md` (0.75rem) should be used for metadata. In the context of a "Vault," these should often be uppercase with +0.05em tracking for a "stamped" feel.

---

## 4. Elevation & Depth: Tonal Layering

Traditional shadows are a fallback; **Tonal Layering** is our primary tool for hierarchy.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This "recessed" look creates a soft, natural lift without visual clutter.
- **Ambient Shadows:** When a float is required, use a shadow with a 24px-32px blur at 6% opacity. The shadow color must be a tint of `on-surface` (`#1b1c1c`), never pure black.
- **The "Ghost Border" Fallback:** For high-density data where tonal shifts fail, use the `outline-variant` token at **15% opacity**. A 100% opaque border is strictly forbidden.
- **Glassmorphism:** Use semi-transparent `surface-container` colors to allow the background hues to bleed through, integrating the UI rather than "pasting" it on top.

---

## 5. Components: The Vault Elements

### Buttons

- **Primary:** Uses the Signature Gradient (`primary` to `primary-container`). `xl` (0.75rem) roundedness.
- **Secondary:** No background. Use `secondary` text with a `surface-container` hover state.
- **Tertiary:** `label-md` style text, underlined only on hover.

### Inputs & Vault Fields

- **Style:** Avoid the "box" look. Use a `surface-container-low` background with a `md` (0.375rem) corner radius.
- **Focus:** Transition the background to `surface-container-high` and apply a 1px `secondary` Ghost Border.

### Cards & Lists

- **Rule:** Forbid the use of divider lines.
- **Implementation:** Use the **Spacing Scale** (specifically `8` (2rem) or `10` (2.5rem)) to separate list items. For high-density lists, alternate background colors between `surface` and `surface-container-low`.

### Specialized: The "Legacy Card"

A unique component for life continuity: A card using `primary-container` background with `on-primary-container` text. This high-contrast block serves as a visual anchor for "pinned" or "vital" information.

---

## 6. Do’s and Don’ts

### Do:

- **Do** use asymmetrical layouts (e.g., a left-aligned headline with a right-aligned body block) to feel more editorial.
- **Do** prioritize `surface-container` shifts over lines.
- **Do** use `secondary_fixed` (`#b9eaff`) for subtle highlights or success states—it’s reassuring without being "clinical."

### Don't:

- **Don't** use 100% opaque borders. They break the "vault" immersion.
- **Don't** use standard "Success Green" or "Warning Orange" unless absolutely necessary for safety. Stick to the `error` (`#ba1a1a`) and `secondary` tokens to maintain the premium mood.
- **Don't** crowd the interface. If the content feels tight, move to the next step on the Spacing Scale.
