import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Icon, cn } from "@keeplas/ui";
import { ICON_PATHS } from "@/lib/icons";
import { getErrorMessage } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import {
  type CameoCompositor,
  type CameoGeometry,
  clampGeometry,
  createCameoCompositor,
  DEFAULT_CAMEO_GEOMETRY,
} from "@/lib/screen-cameo";

type Translator = ReturnType<typeof useTranslations>;

type RecorderMode = "audio" | "video" | "screen";

interface MediaRecorderPanelProps {
  mode: RecorderMode;
  onRecorded: (
    blob: Blob,
    meta: { mimeType: string; durationSec: number },
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
  audio: 30 * 60,
  video: 30 * 60,
  screen: 30 * 60,
};

const WAVEFORM_BARS = 40;

function pickMimeType(mode: RecorderMode): string {
  // Screen capture is video — only audio mode uses the audio codec list.
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

function friendlyError(
  err: unknown,
  mode: RecorderMode,
  t: Translator,
): string {
  const name = (err as { name?: string }).name ?? "";
  // getDisplayMedia rejects with NotAllowedError / AbortError when the user
  // dismisses the picker or cancels the share — not a real permission failure.
  if (
    mode === "screen" &&
    (name === "NotAllowedError" || name === "AbortError")
  ) {
    return t("recorder.errorScreenDenied");
  }
  if (name === "NotAllowedError") {
    return t("recorder.errorPermission", {
      devices:
        mode === "video"
          ? t("recorder.devicesCameraMic")
          : t("recorder.deviceMic"),
    });
  }
  if (name === "NotFoundError") {
    return t("recorder.errorNotFound", {
      devices:
        mode === "video"
          ? t("recorder.devicesCameraOrMic")
          : t("recorder.deviceMic"),
    });
  }
  if (name === "NotReadableError") {
    return t("recorder.errorBusy", {
      device:
        mode === "video"
          ? t("recorder.deviceCameraCapitalized")
          : t("recorder.deviceMicCapitalized"),
    });
  }
  return getErrorMessage(err, t("recorder.errorGeneric"));
}

/** Attach a stream to a hidden <video> and resolve once it can render frames. */
function playVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.srcObject = stream;
  return new Promise((resolve) => {
    if (video.readyState >= 2) {
      video.play().catch(() => {});
      resolve();
      return;
    }
    video.onloadedmetadata = () => {
      video.play().catch(() => {});
      resolve();
    };
  });
}

// Fullscreen helpers with the Safari (webkit) fallback. Using the Fullscreen API
// (rather than a fixed/portal overlay) keeps the recorder's DOM in place, so the
// running cameo compositor's canvas/video refs stay valid while expanding.
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

function currentFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ??
    (document as WebkitDocument).webkitFullscreenElement ??
    null
  );
}

function requestFullscreen(el: HTMLElement): Promise<void> | void {
  if (el.requestFullscreen) return el.requestFullscreen();
  return (el as WebkitElement).webkitRequestFullscreen?.();
}

function exitFullscreen(): Promise<void> | void {
  if (document.exitFullscreen) return document.exitFullscreen();
  return (document as WebkitDocument).webkitExitFullscreen?.();
}

export function MediaRecorderPanel({
  mode,
  onRecorded,
  onCancel,
}: MediaRecorderPanelProps) {
  const t = useTranslations("chrome");
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

  // Screen + camera cameo (mode === "screen" only).
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositorRef = useRef<CameoCompositor | null>(null);
  const sourceStreamsRef = useRef<MediaStream[]>([]);
  const cameoGeometryRef = useRef<CameoGeometry>(DEFAULT_CAMEO_GEOMETRY);
  const cameoLayerRef = useRef<HTMLDivElement | null>(null);
  const cameoDragRef = useRef<"move" | "resize" | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [cameoActive, setCameoActive] = useState(false);
  const [cameoGeom, setCameoGeom] = useState<CameoGeometry>(
    DEFAULT_CAMEO_GEOMETRY,
  );
  const [layerSize, setLayerSize] = useState({ w: 0, h: 0 });
  const [expanded, setExpanded] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null;
    }
  }, []);

  // Tear down the cameo pipeline: draw loop, canvas track, and the raw
  // screen/camera source streams feeding it.
  const stopCameo = useCallback(() => {
    compositorRef.current?.stop();
    compositorRef.current = null;
    sourceStreamsRef.current.forEach((s) =>
      s.getTracks().forEach((track) => track.stop()),
    );
    sourceStreamsRef.current = [];
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null;
    setCameoActive(false);
  }, []);

  // When the user ends the share from the browser's native "Stop sharing" bar,
  // the screen video track fires "ended": finalize the take if we were
  // recording, otherwise surface a retry prompt.
  const attachScreenEndHandler = useCallback(
    (stream: MediaStream) => {
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) return;
      videoTrack.addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        } else {
          stopStream();
          setError(t("recorder.errorScreenDenied"));
          setPhase("error");
        }
      });
    },
    [setPhase, stopStream, t],
  );

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
            : (
                window as unknown as {
                  webkitAudioContext?: typeof AudioContext;
                }
              ).webkitAudioContext;
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
    [drawWaveform],
  );

  const requestStream = useCallback(async (): Promise<MediaStream> => {
    if (mode === "screen") {
      // Screen video + the user's mic narration combined into one stream.
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 24 } },
        audio: true, // tab/system audio if the user opts in via the picker
      });
      let micTrack: MediaStreamTrack | null = null;
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        micTrack = mic.getAudioTracks()[0] ?? null;
      } catch {
        // Mic is optional — fall back to whatever audio the screen share carries.
      }
      const combined = new MediaStream();
      display.getVideoTracks().forEach((track) => combined.addTrack(track));
      // Prefer mic narration; otherwise keep the screen's own audio track.
      if (micTrack) combined.addTrack(micTrack);
      else
        display.getAudioTracks().forEach((track) => combined.addTrack(track));
      return combined;
    }
    const constraints: MediaStreamConstraints =
      mode === "audio"
        ? { audio: true }
        : {
            audio: true,
            video: {
              width: { ideal: 854 },
              height: { ideal: 480 },
              frameRate: { ideal: 24 },
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
      // getDisplayMedia requires a user gesture, which the mount effect lacks —
      // defer screen acquisition to the Start button (handleStart).
      if (mode === "screen") {
        setPhase("live");
        return;
      }
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          throw new Error(t("recorder.notAvailable"));
        }
        const stream = await requestStream();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (mode !== "audio" && livePreviewRef.current) {
          livePreviewRef.current.srcObject = stream;
        }
        if (mode === "audio") setupAudioAnalyser(stream);
        setPhase("live");
      } catch (err) {
        if (!cancelled) {
          setError(friendlyError(err, mode, t));
          setPhase("error");
        }
      }
    }

    warm();

    return () => {
      cancelled = true;
    };
  }, [mode, requestStream, setupAudioAnalyser, setPhase, t]);

  // Global cleanup on unmount — stop recorder, release stream and waveform.
  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      teardownAudioAnalyser();
      stopStream();
      stopCameo();
    };
  }, [clearTimer, stopStream, stopCameo, teardownAudioAnalyser]);

  // Revoke preview URL when it changes.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Track the cameo overlay box size so the drag handle maps to canvas
  // fractions (it re-measures automatically when expanding to full screen).
  useEffect(() => {
    if (!cameoActive) return;
    const el = cameoLayerRef.current;
    if (!el) return;
    const update = () =>
      setLayerSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cameoActive]);

  // Keep `expanded` in sync with the browser fullscreen state (covers Esc / F11
  // and the native exit, which don't go through our toggle button).
  useEffect(() => {
    const onChange = () =>
      setExpanded(currentFullscreenElement() === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const toggleExpand = useCallback(() => {
    if (currentFullscreenElement()) {
      exitFullscreen();
    } else if (containerRef.current) {
      Promise.resolve(requestFullscreen(containerRef.current)).catch(() => {});
    }
  }, []);

  async function handleRetryWarm() {
    stopStream();
    stopCameo();
    teardownAudioAnalyser();
    setError("");
    // Screen acquisition needs a user gesture — return to the idle "click Start"
    // state; handleStart re-acquires on the next click.
    if (mode === "screen") {
      setPhase("live");
      return;
    }
    setPhase("warming");
    try {
      const stream = await requestStream();
      streamRef.current = stream;
      if (mode !== "audio" && livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
      }
      if (mode === "audio") setupAudioAnalyser(stream);
      setPhase("live");
    } catch (err) {
      setError(friendlyError(err, mode, t));
      setPhase("error");
    }
  }

  // Acquire screen + camera, run the compositor, and return the recordable
  // (canvas + mic) stream. Falls back to screen-only if the camera is denied.
  async function acquireCameoStream(): Promise<MediaStream> {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } },
      audio: true,
    });
    let camStream: MediaStream | null = null;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
    } catch {
      // Camera denied — keep the screen recording without the cameo.
    }
    sourceStreamsRef.current = camStream
      ? [screenStream, camStream]
      : [screenStream];
    attachScreenEndHandler(screenStream);

    if (!camStream) {
      setError(t("recorder.cameraDenied"));
      if (livePreviewRef.current)
        livePreviewRef.current.srcObject = screenStream;
      const fallback = new MediaStream();
      screenStream.getTracks().forEach((track) => fallback.addTrack(track));
      return fallback;
    }

    const screenVideo = screenVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    const canvas = cameoCanvasRef.current;
    if (!screenVideo || !cameraVideo || !canvas) {
      throw new Error("Cameo surfaces not mounted");
    }
    await Promise.all([
      playVideo(screenVideo, screenStream),
      playVideo(cameraVideo, camStream),
    ]);

    cameoGeometryRef.current = DEFAULT_CAMEO_GEOMETRY;
    setCameoGeom(DEFAULT_CAMEO_GEOMETRY);
    const compositor = createCameoCompositor({
      screenVideo,
      cameraVideo,
      canvas,
      micTrack: camStream.getAudioTracks()[0] ?? null,
      geometryRef: cameoGeometryRef,
      fps: 30,
    });
    compositorRef.current = compositor;
    setCameoActive(true);
    return compositor.stream;
  }

  // Pointer-driven move / resize of the camera circle. Geometry is stored as
  // fractions, so the compositor (and thus the recording) updates live.
  function pointerFraction(e: React.PointerEvent) {
    const el = cameoLayerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      fx: (e.clientX - rect.left) / rect.width,
      fy: (e.clientY - rect.top) / rect.height,
      rectW: rect.width,
      rectH: rect.height,
      minSide: Math.min(rect.width, rect.height),
    };
  }

  function applyGeom(g: CameoGeometry) {
    const clamped = clampGeometry(g);
    cameoGeometryRef.current = clamped;
    setCameoGeom(clamped);
  }

  function onCameoPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    cameoDragRef.current =
      (e.target as HTMLElement).dataset.cameoResize === "true"
        ? "resize"
        : "move";
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onCameoPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!cameoDragRef.current) return;
    const p = pointerFraction(e);
    if (!p) return;
    if (cameoDragRef.current === "move") {
      applyGeom({ ...cameoGeometryRef.current, cx: p.fx, cy: p.fy });
    } else {
      const c = cameoGeometryRef.current;
      const dx = (p.fx - c.cx) * p.rectW;
      const dy = (p.fy - c.cy) * p.rectH;
      applyGeom({ ...c, r: Math.hypot(dx, dy) / p.minSide });
    }
  }

  function onCameoPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    cameoDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  async function handleStart() {
    let stream = streamRef.current;
    // Screen capture is acquired here (this click is the required user gesture).
    if (!stream && mode === "screen") {
      setPhase("warming");
      try {
        if (cameraEnabled) {
          stream = await acquireCameoStream();
        } else {
          stream = await requestStream();
          if (livePreviewRef.current) livePreviewRef.current.srcObject = stream;
          attachScreenEndHandler(stream);
        }
      } catch (err) {
        stopCameo();
        setError(friendlyError(err, mode, t));
        setPhase("error");
        return;
      }
      streamRef.current = stream;
    }
    if (!stream) {
      setError(t("recorder.deviceNotReady"));
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError(t("recorder.notSupported"));
      return;
    }

    const mimeType = pickMimeType(mode);
    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      setError(getErrorMessage(err, t("recorder.initFailed")));
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
        Math.round((Date.now() - startedAtRef.current) / 1000),
      );
      setRecordedBlob(blob);
      setRecordedMime(finalMime);
      setRecordedDuration(durationSec);
      setPreviewUrl(URL.createObjectURL(blob));
      teardownAudioAnalyser();
      stopStream();
      stopCameo();
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
    stopCameo();
    clearTimer();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  }

  const remainingSec = MAX_DURATION_SEC[mode] - elapsed;

  const subheadline = (() => {
    if (phase === "warming") return t("recorder.subPreparing");
    if (phase === "error") return t("recorder.subUnavailable");
    if (phase === "recording")
      return t("recorder.subRecording", {
        elapsed: formatDuration(elapsed),
        max: formatDuration(MAX_DURATION_SEC[mode]),
      });
    if (phase === "stopped")
      return t("recorder.subPreview", {
        duration: formatDuration(recordedDuration),
      });
    return t("recorder.subIdle", {
      max: formatDuration(MAX_DURATION_SEC[mode]),
    });
  })();

  const showCameraToggle = mode === "screen" && phase === "live";

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-surface-container-low space-y-5",
        expanded ? "overflow-auto rounded-none p-6 md:p-10" : "rounded-2xl p-6",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              mode === "audio"
                ? "bg-secondary/10 text-secondary"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon
              path={
                mode === "audio"
                  ? ICON_PATHS.mic
                  : mode === "screen"
                    ? ICON_PATHS.screen
                    : ICON_PATHS.videocam
              }
              className="w-5 h-5"
            />
          </div>
          <div>
            <p className="text-headline-sm text-primary">
              {mode === "audio"
                ? t("recorder.titleAudio")
                : mode === "screen"
                  ? t("recorder.titleScreen")
                  : t("recorder.titleVideo")}
            </p>
            <p className="text-label-md text-on-surface-variant">
              {subheadline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {mode !== "audio" && (
            <button
              type="button"
              onClick={toggleExpand}
              className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
              aria-label={
                expanded ? t("recorder.collapse") : t("recorder.expand")
              }
              title={expanded ? t("recorder.collapse") : t("recorder.expand")}
            >
              <Icon
                path={expanded ? ICON_PATHS.collapse : ICON_PATHS.expand}
                className="w-4 h-4"
              />
            </button>
          )}
          <button
            type="button"
            onClick={handleCancelAll}
            className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
            aria-label={t("recorder.cancelRecording")}
          >
            <Icon path={ICON_PATHS.close} className="w-4 h-4" />
          </button>
        </div>
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
              {t("recorder.tryAgain")}
            </button>
          )}
        </div>
      )}

      {/* Live visual — video / screen preview or audio waveform */}
      {mode !== "audio" && phase !== "stopped" && (
        <div
          className={cn(
            "relative w-full aspect-video rounded-xl bg-primary/5 overflow-hidden",
            expanded && "mx-auto max-w-6xl max-h-[78vh]",
          )}
        >
          <video
            ref={livePreviewRef}
            autoPlay
            muted
            playsInline
            className={cn(
              "w-full h-full object-cover",
              cameoActive && "hidden",
            )}
          />
          {mode === "screen" && (
            <canvas
              ref={cameoCanvasRef}
              className={cn(
                "w-full h-full object-contain bg-black",
                !cameoActive && "hidden",
              )}
            />
          )}
          {/* Draggable / resizable camera circle (mirrors the canvas cameo). */}
          {cameoActive && (
            <div ref={cameoLayerRef} className="absolute inset-0">
              <div
                className="absolute rounded-full border-2 border-dashed border-white/80 cursor-move touch-none"
                style={{
                  width: 2 * cameoGeom.r * Math.min(layerSize.w, layerSize.h),
                  height: 2 * cameoGeom.r * Math.min(layerSize.w, layerSize.h),
                  left: cameoGeom.cx * layerSize.w,
                  top: cameoGeom.cy * layerSize.h,
                  transform: "translate(-50%, -50%)",
                }}
                onPointerDown={onCameoPointerDown}
                onPointerMove={onCameoPointerMove}
                onPointerUp={onCameoPointerUp}
              >
                <div
                  data-cameo-resize="true"
                  className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-white shadow cursor-nwse-resize"
                />
              </div>
            </div>
          )}
          {phase === "warming" && (
            <div className="absolute inset-0 flex items-center justify-center text-body-md text-on-surface-variant gap-2 bg-surface-container-high/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              {mode === "screen"
                ? t("recorder.startingScreenShare")
                : t("recorder.turningOnCamera")}
            </div>
          )}
          {/* Screen capture has no live preview until the share starts. */}
          {mode === "screen" && phase === "live" && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-body-md text-on-surface-variant px-6 bg-surface-container-high/60">
              {t("recorder.screenIdleHint")}
            </div>
          )}
          {(phase === "recording" ||
            (phase === "live" && mode !== "screen")) && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-primary/80 text-on-primary text-label-md px-3 py-1 rounded-full">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  phase === "recording"
                    ? "bg-error animate-pulse"
                    : "bg-secondary",
                )}
              />
              {phase === "recording"
                ? t("recorder.statusRecording")
                : t("recorder.statusLivePreview")}
            </div>
          )}
        </div>
      )}

      {mode === "audio" && phase !== "stopped" && (
        <div className="relative w-full h-28 rounded-xl bg-surface overflow-hidden flex items-center justify-center">
          <canvas ref={canvasRef} className="w-full h-full" aria-hidden />
          {phase === "warming" && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-body-md text-on-surface-variant bg-surface-container-high/60">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/70 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
              </span>
              {t("recorder.enablingMic")}
            </div>
          )}
          {(phase === "live" || phase === "recording") && (
            <div className="absolute top-2 right-3 flex items-center gap-2 text-label-md text-on-surface-variant">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  phase === "recording"
                    ? "bg-error animate-pulse"
                    : "bg-secondary",
                )}
              />
              {phase === "recording"
                ? t("recorder.statusRecording")
                : t("recorder.statusMicLive")}
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
            {t("recorder.timeLeft", {
              time: formatDuration(Math.max(0, remainingSec)),
            })}
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

      {cameoActive && (
        <p className="text-label-md text-on-surface-variant text-center">
          {t("recorder.cameoDragHint")}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancelAll}
            className="text-body-md font-bold text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            {t("recorder.cancel")}
          </button>
          {showCameraToggle && (
            <button
              type="button"
              onClick={() => setCameraEnabled((v) => !v)}
              aria-pressed={cameraEnabled}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-label-md cursor-pointer transition-colors",
                cameraEnabled
                  ? "bg-primary/10 text-primary"
                  : "bg-surface-container-high text-on-surface-variant",
              )}
            >
              <Icon path={ICON_PATHS.videocam} className="w-4 h-4" />
              {t("recorder.toggleCamera")}
            </button>
          )}
        </div>

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
              {t("recorder.startRecording")}
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
              {t("recorder.stop")}
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
                {t("recorder.reRecord")}
              </Button>
              <Button
                type="button"
                variant="vault"
                size="md"
                onClick={handleSave}
                className="gap-2 cursor-pointer"
              >
                {t("recorder.attachToVault")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Hidden sources feeding the cameo compositor (never shown directly). */}
      <video ref={screenVideoRef} muted playsInline className="hidden" />
      <video ref={cameraVideoRef} muted playsInline className="hidden" />
    </div>
  );
}
