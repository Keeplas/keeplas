import { useRef, useState } from "react";
import { cn, Icon } from "@keeplas/ui";
import { formatClock } from "@/lib/format";
import { ICON_PATHS } from "@/lib/icons";
import { useTranslations } from "@/lib/i18n";

const CONTROL =
  "flex shrink-0 items-center justify-center rounded-xs text-header-text hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus";

/**
 * W06-9 player for a decrypted video or voice note: a big play button, then
 * play / pause, time, scrubber, mute and full screen over a dark shade. The
 * media streams from a blob URL of the decrypted copy, never saved to disk.
 * Key it by file so another file starts from 0:00.
 */
export function MediaPlayer({
  kind,
  src,
  poster,
  durationSec,
}: {
  kind: "video" | "audio";
  /** undefined while the file decrypts. */
  src: string | undefined;
  poster?: string;
  /** Known length, shown before the media loads. */
  durationSec?: number;
}) {
  const t = useTranslations("vaultItem.preview");
  const frame = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(durationSec ?? 0);

  const toggle = () => {
    const element = media.current;
    if (!element || !src) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  const events = {
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onTimeUpdate: () => setTime(media.current?.currentTime ?? 0),
    onLoadedMetadata: () => {
      const length = media.current?.duration;
      if (length && Number.isFinite(length)) setDuration(length);
    },
  };
  const played = duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div
      ref={frame}
      className={cn(
        "relative w-full shrink-0 overflow-hidden rounded-md bg-bg-header",
        kind === "video" ? "aspect-[650/367]" : "h-[220px]",
      )}
    >
      {kind === "video" ? (
        <video
          ref={media}
          src={src}
          poster={poster}
          playsInline
          muted={muted}
          onClick={toggle}
          className="size-full object-contain"
          {...events}
        />
      ) : (
        <>
          <audio ref={media} src={src} muted={muted} {...events} />
          <span className="flex size-full items-center justify-center pb-[64px] text-header-text-muted">
            <Icon path={ICON_PATHS.mic} className="size-[48px]" />
          </span>
        </>
      )}

      {!playing ? (
        <button
          type="button"
          aria-label={t("play")}
          onClick={toggle}
          disabled={!src}
          className="absolute top-1/2 left-1/2 flex size-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-header-text pl-[4px] text-bg-header shadow-[0_6px_20px_rgb(0_0_0/0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus disabled:cursor-wait"
        >
          <Icon path={ICON_PATHS.play} className="size-[32px]" />
        </button>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex h-[64px] items-center gap-[14px] bg-bg-header/70 px-[18px]">
        <button
          type="button"
          aria-label={playing ? t("pause") : t("play")}
          onClick={toggle}
          disabled={!src}
          className={CONTROL}
        >
          <Icon
            path={playing ? ICON_PATHS.pause : ICON_PATHS.play}
            className="size-[20px]"
          />
        </button>
        <span className="shrink-0 text-[13px] leading-[18px] font-medium text-header-text tabular-nums">
          {formatClock(time)} / {formatClock(duration)}
        </span>
        <input
          type="range"
          aria-label={t("position")}
          min={0}
          max={duration || 1}
          step={0.1}
          value={time}
          disabled={!src}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (media.current) media.current.currentTime = next;
            setTime(next);
          }}
          style={{
            background: `linear-gradient(to right, var(--color-progress-fill) ${played}%, color-mix(in srgb, var(--color-header-text) 30%, transparent) ${played}%)`,
          }}
          className="h-[4px] min-w-0 flex-1 cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus [&::-moz-range-thumb]:size-[14px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-header-text [&::-webkit-slider-thumb]:size-[14px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-header-text"
        />
        <button
          type="button"
          aria-label={muted ? t("unmute") : t("mute")}
          aria-pressed={muted}
          onClick={() => setMuted(!muted)}
          className={CONTROL}
        >
          <Icon
            path={muted ? ICON_PATHS.volumeOff : ICON_PATHS.volume}
            className="size-[20px]"
          />
        </button>
        {kind === "video" ? (
          <button
            type="button"
            aria-label={t("fullScreen")}
            onClick={() => void frame.current?.requestFullscreen?.()}
            className={CONTROL}
          >
            <Icon path={ICON_PATHS.fullscreen} className="size-[18px]" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Under the player (W06-9): the media plays from memory, never from disk. */
export function StreamNote() {
  const t = useTranslations("vaultItem.preview");
  return (
    <p className="flex items-center gap-[8px] text-body-sm text-text-muted">
      <Icon path={ICON_PATHS.shieldCheck} className="size-[16px] shrink-0" />
      {t("streams")}
    </p>
  );
}
