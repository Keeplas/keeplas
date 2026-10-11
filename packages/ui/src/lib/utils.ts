import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Register the custom type scale (`@utility text-*` in globals.css) as font
// sizes. Otherwise tailwind-merge reads `text-h1` as a text color and drops it
// when a real color like `text-text-primary` follows.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        // v2 scale (Figma Foundations)
        "display",
        "h1",
        "h2",
        "h3",
        "body-lg",
        "body",
        "label",
        "body-sm",
        "caption",
        "code",
        "button",
        // Legacy scale, removed once screens are rebuilt (v2 phase 7)
        "display-lg",
        "display-md",
        "headline-lg",
        "headline-md",
        "headline-sm",
        "body-md",
        "label-lg",
        "label-md",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
