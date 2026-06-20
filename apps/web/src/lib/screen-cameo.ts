/**
 * Screen + camera "cameo" compositor.
 *
 * Draws a screen-share video full-frame onto a canvas and overlays the camera
 * as a draggable / resizable circle, then exposes the canvas as a recordable
 * MediaStream (canvas.captureStream + the user's mic). Recording the canvas is
 * what bakes the camera circle into the saved video (a DOM overlay would not
 * appear in the file).
 *
 * Pure, framework-agnostic: the React panel owns state and lifecycle; this
 * module owns the per-frame drawing and the output stream.
 */

export interface CameoGeometry {
  /** Circle center X, as a fraction (0..1) of the canvas width. */
  cx: number;
  /** Circle center Y, as a fraction (0..1) of the canvas height. */
  cy: number;
  /** Circle radius, as a fraction (0..1) of min(width, height). */
  r: number;
}

export interface CameoCompositor {
  /** Composited video (from the canvas) plus the mic audio track, if any. */
  stream: MediaStream;
  /** Stop the draw loop and release the canvas capture track. */
  stop: () => void;
}

export const DEFAULT_CAMEO_GEOMETRY: CameoGeometry = {
  cx: 0.88,
  cy: 0.84,
  r: 0.11,
};

/** Clamp the geometry so the whole circle stays inside the frame. */
export function clampGeometry(g: CameoGeometry): CameoGeometry {
  const r = Math.min(0.35, Math.max(0.08, g.r));
  return {
    r,
    cx: Math.min(1 - r, Math.max(r, g.cx)),
    cy: Math.min(1 - r, Math.max(r, g.cy)),
  };
}

interface CompositorOptions {
  screenVideo: HTMLVideoElement;
  cameraVideo: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  micTrack: MediaStreamTrack | null;
  /** Read every frame so live drag / resize is reflected in the recording. */
  geometryRef: { current: CameoGeometry };
  /** Toggle the camera circle on/off live (even mid-recording). */
  drawCameraRef?: { current: boolean };
  fps?: number;
}

export function createCameoCompositor({
  screenVideo,
  cameraVideo,
  canvas,
  micTrack,
  geometryRef,
  drawCameraRef,
  fps = 30,
}: CompositorOptions): CameoCompositor {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let rafId: number | null = null;

  const draw = () => {
    const w = screenVideo.videoWidth || canvas.width || 1280;
    const h = screenVideo.videoHeight || canvas.height || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Screen, full frame.
    ctx.drawImage(screenVideo, 0, 0, w, h);

    // Camera, cover-fit into a circle at the requested position.
    const g = clampGeometry(geometryRef.current);
    const radius = g.r * Math.min(w, h);
    const cx = g.cx * w;
    const cy = g.cy * h;

    const drawCamera = drawCameraRef?.current ?? true;
    const camW = cameraVideo.videoWidth;
    const camH = cameraVideo.videoHeight;
    if (drawCamera && camW > 0 && camH > 0) {
      // Square cover crop of the camera frame.
      const side = Math.min(camW, camH);
      const sx = (camW - side) / 2;
      const sy = (camH - side) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      // Mirror horizontally for a natural selfie view.
      ctx.translate(cx + radius, cy - radius);
      ctx.scale(-1, 1);
      ctx.drawImage(
        cameraVideo,
        sx,
        sy,
        side,
        side,
        0,
        0,
        radius * 2,
        radius * 2,
      );
      ctx.restore();
    }

    rafId = requestAnimationFrame(draw);
  };

  draw();

  const stream = canvas.captureStream(fps);
  if (micTrack) stream.addTrack(micTrack);

  return {
    stream,
    stop: () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
