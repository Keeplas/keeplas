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

type RecorderState = "idle" | "recording" | "stopped";

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

export function MediaRecorderPanel({
  mode,
  onRecorded,
  onCancel,
}: MediaRecorderPanelProps) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const livePreviewRef = useRef<HTMLVideoElement | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<RecorderState>("idle");
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

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      recorderRef.current?.state === "recording" && recorderRef.current.stop();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [clearTimer, stopStream, previewUrl]);

  async function requestStream(): Promise<MediaStream> {
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
  }

  async function handleStart() {
    setError("");

    if (typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await requestStream();
    } catch (err) {
      const name = (err as { name?: string }).name ?? "";
      if (name === "NotAllowedError") {
        setError(
          `Permission refused. Enable ${mode === "video" ? "camera and microphone" : "microphone"} access in your browser settings.`
        );
      } else if (name === "NotFoundError") {
        setError(
          `No ${mode === "video" ? "camera or microphone" : "microphone"} detected on this device.`
        );
      } else if (name === "NotReadableError") {
        setError(
          `${mode === "video" ? "Camera" : "Microphone"} is busy in another app.`
        );
      } else {
        setError(getErrorMessage(err, "Unable to start recording."));
      }
      return;
    }

    streamRef.current = stream;
    if (mode === "video" && livePreviewRef.current) {
      livePreviewRef.current.srcObject = stream;
    }

    const mimeType = pickMimeType(mode);
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      stopStream();
      setError(getErrorMessage(err, "MediaRecorder initialization failed."));
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      const finalMime = recorder.mimeType || mimeType || "application/octet-stream";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      setRecordedBlob(blob);
      setRecordedMime(finalMime);
      setRecordedDuration(durationSec);
      setPreviewUrl(URL.createObjectURL(blob));
      setState("stopped");
      stopStream();
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start(250);
    setState("recording");
    setElapsed(0);

    timerRef.current = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= MAX_DURATION_SEC[mode]) {
        recorder.state === "recording" && recorder.stop();
      }
    }, 250);
  }

  function handleStop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  function handleReset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setRecordedBlob(null);
    setRecordedMime("");
    setRecordedDuration(0);
    setPreviewUrl("");
    setElapsed(0);
    setState("idle");
  }

  function handleSave() {
    if (!recordedBlob) return;
    const mimeType = recordedMime || recordedBlob.type || "application/octet-stream";
    onRecorded(recordedBlob, { mimeType, durationSec: recordedDuration });
  }

  function handleCancelAll() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    stopStream();
    clearTimer();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  }

  const remainingSec = MAX_DURATION_SEC[mode] - elapsed;

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
            <p className="font-headline font-bold text-primary text-sm">
              {mode === "audio" ? "Voice recording" : "Video recording"}
            </p>
            <p className="text-[11px] text-on-surface-variant">
              {state === "recording"
                ? `Recording — ${formatDuration(elapsed)} / max ${formatDuration(MAX_DURATION_SEC[mode])}`
                : state === "stopped"
                  ? `Preview — ${formatDuration(recordedDuration)}`
                  : `Encrypted on your device. Max ${formatDuration(MAX_DURATION_SEC[mode])}.`}
            </p>
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
          className="bg-error-container/40 text-on-error-container text-xs rounded-xl px-4 py-3"
        >
          {error}
        </div>
      )}

      {mode === "video" && state !== "stopped" && (
        <video
          ref={livePreviewRef}
          autoPlay
          muted
          playsInline
          className="w-full aspect-video rounded-xl bg-primary/5 object-cover"
        />
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error/70 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-error" />
          </span>
          <span className="font-mono text-sm text-primary tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="ml-auto text-[11px] text-on-surface-variant">
            {formatDuration(Math.max(0, remainingSec))} left
          </span>
        </div>
      )}

      {state === "stopped" && previewUrl && (
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
          className="text-on-surface-variant hover:text-primary font-headline font-bold text-sm transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          {state === "idle" && (
            <Button
              type="button"
              variant="vault"
              size="md"
              onClick={handleStart}
              className="gap-2 cursor-pointer"
            >
              <Icon path={ICON_PATHS.record} className="w-4 h-4" />
              Start recording
            </Button>
          )}

          {state === "recording" && (
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

          {state === "stopped" && (
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
