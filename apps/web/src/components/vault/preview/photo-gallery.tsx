import { useRef, useState, type PointerEvent } from "react";
import { cn } from "@keeplas/ui";
import { useTranslations } from "@/lib/i18n";

interface Offset {
  x: number;
  y: number;
}

const CENTER: Offset = { x: 0, y: 0 };

export function clampPan(
  offset: Offset,
  zoom: number,
  stage: { width: number; height: number },
): Offset {
  const maxX = (stage.width * (zoom - 1)) / 2;
  const maxY = (stage.height * (zoom - 1)) / 2;
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}

/**
 * W06-8 photo stage: the current photo on a dark stage (rotated and zoomed
 * with the toolbar), then a strip of thumbnails when there are several.
 */
export function PhotoGallery({
  photos,
  current,
  onSelect,
  rotation,
  zoom,
}: {
  /** Decrypted image URLs; undefined while one decrypts. */
  photos: (string | undefined)[];
  current: number;
  onSelect: (index: number) => void;
  /** Quarter turns, clockwise. */
  rotation: number;
  zoom: number;
}) {
  const t = useTranslations("vaultItem.preview");
  const src = photos[current];
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: Offset } | null>(null);
  const [pan, setPan] = useState<{ key: string; offset: Offset }>({
    key: "",
    offset: CENTER,
  });
  const panKey = `${current}:${zoom}:${rotation}`;
  const offset = zoom > 1 && pan.key === panKey ? pan.offset : CENTER;
  const [dragging, setDragging] = useState(false);

  function start(event: PointerEvent<HTMLDivElement>) {
    if (zoom <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, from: offset };
    setDragging(true);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    const box = stage.current;
    if (!from || !box) return;
    setPan({
      key: panKey,
      offset: clampPan(
        {
          x: from.from.x + event.clientX - from.x,
          y: from.from.y + event.clientY - from.y,
        },
        zoom,
        { width: box.clientWidth, height: box.clientHeight },
      ),
    });
  }

  function end() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
      <div
        ref={stage}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className={cn(
          "flex min-h-[300px] flex-1 touch-none items-center justify-center overflow-hidden rounded-md bg-bg-header px-[25px] py-[25px] select-none",
          zoom > 1 && (dragging ? "cursor-grabbing" : "cursor-grab"),
        )}
      >
        {src ? (
          <img
            src={src}
            alt={t("photoOf", { photo: current + 1, total: photos.length })}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation * 90}deg) scale(${zoom})`,
            }}
            className={cn(
              "max-h-full max-w-full rounded-[4px] object-contain",
              !dragging && "transition-transform",
            )}
          />
        ) : (
          <span className="size-[48px] animate-pulse rounded-full bg-header-text-muted/30" />
        )}
      </div>
      {photos.length > 1 ? (
        <ol className="flex h-[56px] shrink-0 justify-center gap-[8px] overflow-x-auto">
          {photos.map((thumb, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-label={t("photoOf", {
                  photo: index + 1,
                  total: photos.length,
                })}
                aria-current={index === current ? "true" : undefined}
                className={cn(
                  "block h-[56px] w-[76px] overflow-hidden rounded-[6px] bg-bg-header focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                  index === current
                    ? "border-2 border-border-focus"
                    : "opacity-70 hover:opacity-100",
                )}
              >
                {thumb ? (
                  <img src={thumb} alt="" className="size-full object-cover" />
                ) : null}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
