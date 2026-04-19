"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon, cn } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";

type RecorderMode = "audio" | "video";

interface MediaRecorderPanelProps {
  mode: RecorderMode;
  onRecorded: (
    blob: Blob,
    meta: { mimeType: string; durationSec: number }
  ) => void;
  onCancel: () => void;
}

type Phase = "warming" | "live" | "recording" | "stopped" | "error";

const AUDIO_MIME_CANDIDATES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const VIDEO_MIME_CANDIDATES = [
  "video/mp4;codecs=h264,aac",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

const MAX_DURATION_SEC: Record<RecorderMode, number> = {
  audio: 15 * 60,
  video: 3 * 60,
};

const WAVEFORM_BARS = 40;

function pickMimeType(mode: RecorderMode): string {
  const list = mode === "audio" ? AUDIO_MIME_CANDIDATES : VIDEO_MIME_CANDIDATES;
  for (const candidate of list) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(candidate)
    ) {
      return candidate;
    }
  }
  return "";
}

function formatDuration(totalSec: number): string {
  const minutes = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSec % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function friendlyError(err: unknown, mode: RecorderMode): string {
  const name = (err as { name?: string }).name ?? "";
  if (name === "NotAllowedError") {
    return `Permission refused. Enable ${mode === "video" ? "camera and microphone" : "microphone"} access in your browser settings.`;
  }
  if (name === "NotFoundError") {
    return `No ${mode === "video" ? "camera or microphone" : "microphone"} detected on this device.`;
  }
  if (name === "NotReadableError") {
    return `${mode === "video" ? "Camera" : "Microphone"} is busy in another app.`;
  }
  return getErrorMessage(err, "Unable to access capture devices.");
}

export function MediaRecorderPanel({
  mode,
  onRecorded,
  onCancel,
}: MediaRecorderPanelProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("warming");

  const [phase, _setPhase] = useState<Phase>("warming");
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    _setPhase(next);
  }, []);

  const [error, setError] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>("");
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
  }, []);

  const teardownAudioAnalyser = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    if (canvas.width !== cssWidth * dpr || canvas.height !== cssHeight * dpr) {
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bufferLength = analyser.frequencyBinCount;
    const data = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const barWidth = cssWidth / WAVEFORM_BARS;
      const isRecording = phaseRef.current === "recording";
      const color = isRecording ? "#ba1a1a" : "#28657a";

      for (let i = 0; i < WAVEFORM_BARS; i++) {
        const idx = Math.floor((i * bufferLength) / WAVEFORM_BARS);
        const value = data[idx] ?? 0;
        const normalized = value / 255;
        const height = Math.max(3, normalized * cssHeight * 0.85);

        const x = i * barWidth + barWidth * 0.15;
        const w = barWidth * 0.7;
        const y = (cssHeight - height) / 2;

        ctx.fillStyle = color;
        // Rounded bar — fallback for older browsers that lack roundRect
        if (typeof ctx.roundRect === "function") {
          ctx.beginPath();
          ctx.roundRect(x, y, w, height, 2);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, height);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    render();
  }, []);

  const setupAudioAnalyser = useCallback(
    (stream: MediaStream) => {
      try {
        const Ctor =
          typeof AudioContext !== "undefined"
            ? AudioContext
            : (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
        if (!Ctor) return;
        const audioCtx = new Ctor();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        sourceNodeRef.current = source;
        analyserRef.current = analyser;
        drawWaveform();
      } catch {
        // Waveform is optional — silent failure keeps recording functional.
      }
    },
    [drawWaveform]
  );

  const requestStream = useCallback(async (): Promise<MediaStream> => {
    const constraints: MediaStreamConstraints =
      mode === "audio"
        ? { audio: true }
        : {
            audio: true,
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }, [mode]);

  // Pre-arm camera / microphone as soon as the panel mounts so the user
  // sees a live preview (video) or waveform (audio) before clicking Start.
  useEffect(() => {
    let cancelled = false;

    async function warm() {
      setPhase("warming");
      setError("");
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          throw new Error("Media capture is not available in this browser.");
        }
        const stream = await requestStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (mode === "video" && livePreviewRef.current) {
          livePreviewRef.current.srcObject = stream;
        }
        setupAudioAnalyser(stream);
        setPhase("live");
      } catch (err) {
        if (!cancelled) {
          setError(friendlyError(err, mode));
          setPhase("error");
        }
      }
    }

    warm();

    return () => {
      cancelled = true;
    };
  }, [mode, requestStream, setupAudioAnalyser, setPhase]);

  // Global cleanup on unmount — stop recorder, release stream and waveform.
  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      teardownAudioAnalyser();
      stopStream();
    };
  }, [clearTimer, stopStream, teardownAudioAnalyser]);

  // Revoke preview URL when it changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleRetryWarm() {
    stopStream();
    teardownAudioAnalyser();
    setError("");
    setPhase("warming");
    try {
      const stream = await requestStream();
      streamRef.current = stream;
      if (mode === "video" && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
      }
      setupAudioAnalyser(stream);
      setPhase("live");
    } catch (err) {
      setError(friendlyError(err, mode));
      setPhase("error");
    }
  }

  function handleStart() {
    const stream = streamRef.current;
    if (!stream) {
      setError("Capture device is not ready yet. Please wait.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }

    const mimeType = pickMimeType(mode);
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      setError(getErrorMessage(err, "MediaRecorder initialization failed."));
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      const finalMime =
        recorder.mimeType || mimeType || "application/octet-stream";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      setRecordedBlob(blob);
      setRecordedMime(finalMime);
      setRecordedDuration(durationSec);
      setPreviewUrl(URL.createObjectURL(blob));
      teardownAudioAnalyser();
      stopStream();
      setPhase("stopped");
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start(250);
    setPhase("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_DURATION_SEC[mode]) {
        if (recorder.state === "recording") recorder.stop();
      }
    }, 250);
  }

  function handleStop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRecordedBlob(null);
    setRecordedMime("");
    setRecordedDuration(0);
    setPreviewUrl("");
    setElapsed(0);
    await handleRetryWarm();
  }

  function handleSave() {
    if (!recordedBlob) return;
    const mimeType =
      recordedMime || recordedBlob.type || "application/octet-stream";
    onRecorded(recordedBlob, { mimeType, durationSec: recordedDuration });
  }

  function handleCancelAll() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    teardownAudioAnalyser();
    stopStream();
    clearTimer();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  }

  const remainingSec = MAX_DURATION_SEC[mode] - elapsed;

  const subheadline = (() => {
    if (phase === "warming") return "Preparing capture device…";
    if (phase === "error")
      return "Capture unavailable. Adjust permissions and retry.";
    if (phase === "recording")
      return `Recording — ${formatDuration(elapsed)} / max ${formatDuration(MAX_DURATION_SEC[mode])}`;
    if (phase === "stopped") return `Preview — ${formatDuration(recordedDuration)}`;
    return `Encrypted on your device. Max ${formatDuration(MAX_DURATION_SEC[mode])}.`;
  })();

  return (
    <div className="bg-surface-container-low rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              mode === "audio"
                ? "bg-secondary/10 text-secondary"
                : "bg-primary/10 text-primary"
            )}
          >
            <Icon
              path={mode === "audio" ? ICON_PATHS.mic : ICON_PATHS.videocam}
              className="w-5 h-5"
            />
          </div>
          <div>
            <p className="text-headline-sm text-primary">
              {mode === "audio" ? "Voice recording" : "Video recording"}
            </p>
            <p className="text-label-md text-on-surface-variant">{subheadline}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCancelAll}
          className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
          aria-label="Cancel recording"
        >
          <Icon path={ICON_PATHS.close} className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 bg-error-container/40 text-on-error-container text-body-md rounded-xl px-4 py-3"
        >
          <Icon path={ICON_PATHS.warning} className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          {phase === "error" && (
            <button
              type="button"
              onClick={handleRetryWarm}
              className="text-label-md hover:underline cursor-pointer"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Live visual — video preview or audio waveform */}
      {mode === "video" && phase !== "stopped" && (
        <div className="relative w-full aspect-video rounded-xl bg-primary/5 overflow-hidden">
          <video
            ref={livePreviewRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {phase === "warming" && (
            <div className="absolute inset-0 flex items-center justify-center text-body-md text-on-surface-variant gap-2 bg-surface-container-high/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Turning on camera…
            </div>
          )}
          {(phase === "live" || phase === "recording") && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-primary/80 text-on-primary text-label-md px-3 py-1 rounded-full">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  phase === "recording" ? "bg-error animate-pulse" : "bg-secondary"
                )}
              />
              {phase === "recording" ? "Recording" : "Live preview"}
            </div>
          )}
        </div>
      )}

      {mode === "audio" && phase !== "stopped" && (
        <div className="relative w-full h-28 rounded-xl bg-surface overflow-hidden flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            aria-hidden
          />
          {phase === "warming" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-body-md text-on-surface-variant bg-surface-container-high/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              Enabling microphone…
            </div>
          )}
          {(phase === "live" || phase === "recording") && (
            <div className="absolute top-2 right-3 flex items-center gap-2 text-label-md text-on-surface-variant">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  phase === "recording" ? "bg-error animate-pulse" : "bg-secondary"
                )}
              />
              {phase === "recording" ? "Recording" : "Mic live"}
            </div>
          )}
        </div>
      )}

      {phase === "recording" && (
        <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error/70 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
          </span>
          <span className="font-mono text-body-md text-primary tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="ml-auto text-label-md text-on-surface-variant">
            {formatDuration(Math.max(0, remainingSec))} left
          </span>
        </div>
      )}

      {phase === "stopped" && previewUrl && (
        <div className="rounded-xl overflow-hidden bg-surface">
          {mode === "audio" ? (
            <audio controls src={previewUrl} className="w-full" />
          ) : (
            <video
              controls
              src={previewUrl}
              className="w-full aspect-video object-contain bg-primary/5"
            />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={handleCancelAll}
          className="text-body-md font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          {(phase === "warming" || phase === "error" || phase === "live") && (
            <Button
              type="button"
              variant="vault"
              size="md"
              onClick={handleStart}
              disabled={phase !== "live"}
              className="gap-2 cursor-pointer"
            >
              <Icon path={ICON_PATHS.record} className="w-4 h-4" />
              Start recording
            </Button>
          )}

          {phase === "recording" && (
            <Button
              type="button"
              variant="destructive"
              size="md"
              onClick={handleStop}
              className="gap-2 cursor-pointer"
            >
              <Icon path={ICON_PATHS.stop} className="w-4 h-4" filled />
              Stop
            </Button>
          )}

          {phase === "stopped" && (
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleReset}
                className="gap-2 cursor-pointer"
              >
                <Icon path={ICON_PATHS.refresh} className="w-4 h-4" />
                Re-record
              </Button>
              <Button
                type="button"
                variant="vault"
                size="md"
                onClick={handleSave}
                className="gap-2 cursor-pointer"
              >
                Attach to vault
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
