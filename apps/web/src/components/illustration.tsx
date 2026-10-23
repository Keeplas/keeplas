import type { ComponentProps } from "react";

type IllustrationProps = Omit<ComponentProps<"img">, "alt"> & { src: string };

/**
 * Decorative SVG with embedded ambient animations (same files and pattern as the
 * keeplas-website). The SVG stays still unless it is requested as `#play`, which
 * only happens when the visitor has no reduced-motion preference.
 */
export function Illustration({ src, ...props }: IllustrationProps) {
  return (
    <picture className="contents">
      {/* Hidden: through `contents` it would otherwise become a flex/grid item and add a gap. */}
      <source
        className="hidden"
        srcSet={`${src}#play`}
        media="(prefers-reduced-motion: no-preference)"
      />
      <img src={src} alt="" {...props} />
    </picture>
  );
}
