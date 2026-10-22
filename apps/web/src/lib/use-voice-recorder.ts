import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState =
  "starting" | "recording" | "paused" | "denied" | "unavailable";

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

// Safari records AAC in MP4; Chrome and Firefox Opus in WebM.
const MIME_CANDIDATES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

/** Bars of the W06-6 level meter, newest last. */
export const LEVEL_BARS = 36;
const LEVEL_INTERVAL_MS = 120;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}

/**
 * A voice recording made in this browser (W06-6): starts on mount, can be
 * paused, reset and finished; `levels` drives the meter (0 to 1). The audio
 * stays in memory until the caller encrypts it; stopping releases the
 * microphone.
 */
export function useVoiceRecorder(maxSeconds: number) {
  const [state, setState] = useState<RecorderState>("starting");
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [attempt, setAttempt] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const clock = useRef({ startedAt: 0, pausedMs: 0, pausedAt: 0 });
  const finished = useRef<((recording: Recording) => void) | null>(null);

  const seconds = useCallback(() => {
    const { startedAt, pausedMs, pausedAt } = clock.current;
    const now = pausedAt || Date.now();
    return Math.max(0, (now - startedAt - pausedMs) / 1000);
  }, []);

  useEffect(() => {
    let alive = true;
    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error) {
        if (alive) {
          setState(
            (error as { name?: string }).name === "NotAllowedError"
              ? "denied"
              : "unavailable",
          );
        }
        return;
      }
      if (!alive) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = pickMimeType();
      const media = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      chunks.current = [];
      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      media.onstop = () => {
        const type = media.mimeType || mimeType || "audio/webm";
        finished.current?.({
          blob: new Blob(chunks.current, { type }),
          mimeType: type,
          durationSec: Math.round(seconds()),
        });
        finished.current = null;
      };
      recorder.current = media;

      audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 256;
      audio.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      clock.current = { startedAt: Date.now(), pausedMs: 0, pausedAt: 0 };
      media.start(1000);
      setState("recording");
      setElapsed(0);
      setLevels([]);

      timer = setInterval(() => {
        if (media.state !== "recording") return;
        analyser.getByteTimeDomainData(samples);
        let peak = 0;
        for (const sample of samples) {
          peak = Math.max(peak, Math.abs(sample - 128) / 128);
        }
        setLevels((current) =>
          [...current, Math.min(1, peak * 2.5)].slice(-LEVEL_BARS),
        );
        const now = seconds();
        setElapsed(now);
        // At the limit the take pauses: the owner saves or discards it.
        if (now >= maxSeconds) {
          media.pause();
          clock.current.pausedAt = Date.now();
          setState("paused");
        }
      }, LEVEL_INTERVAL_MS);
    })();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      recorder.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      void audio?.close();
    };
  }, [attempt, maxSeconds, seconds]);

  const pause = useCallback(() => {
    if (recorder.current?.state !== "recording") return;
    recorder.current.pause();
    clock.current.pausedAt = Date.now();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (recorder.current?.state !== "paused") return;
    clock.current.pausedMs += Date.now() - clock.current.pausedAt;
    clock.current.pausedAt = 0;
    recorder.current.resume();
    setState("recording");
  }, []);

  /** Throws the take away and records again (also retries the microphone). */
  const reset = useCallback(() => {
    finished.current = null;
    setState("starting");
    setAttempt((count) => count + 1);
  }, []);

  /** Ends the take; resolves with the recording. */
  const finish = useCallback(
    () =>
      new Promise<Recording>((resolve, reject) => {
        const media = recorder.current;
        if (!media || media.state === "inactive") {
          reject(new Error("Nothing recorded"));
          return;
        }
        if (media.state === "paused") {
          clock.current.pausedMs += Date.now() - clock.current.pausedAt;
          clock.current.pausedAt = 0;
        }
        finished.current = resolve;
        media.stop();
      }),
    [],
  );

  return { state, elapsed, levels, pause, resume, reset, finish };
}
