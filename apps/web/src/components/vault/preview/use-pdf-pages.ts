import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageImage } from "./document-pages";

/** Width of a page at 100 % (W06-2 page frame), in CSS px. */
const PAGE_WIDTH = 470;
const THUMB_WIDTH = 64;

async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  // pdf.js is large: loaded only when a PDF is opened.
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // No eval (the CSP refuses it); the decrypted bytes never leave the page.
  return await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
}

async function renderPage(
  pdf: PDFDocumentProxy,
  index: number,
  cssWidth: number,
): Promise<PageImage> {
  const page = await pdf.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const scale = cssWidth / base.width;
  const ratio = window.devicePixelRatio || 1;
  const viewport = page.getViewport({ scale: scale * ratio });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve),
  );
  if (!blob) throw new Error("Page render failed");
  return {
    src: URL.createObjectURL(blob),
    width: cssWidth,
    height: (base.height * cssWidth) / base.width,
  };
}

/**
 * A decrypted PDF rendered page by page in this browser (pdf.js, in a
 * worker): every thumbnail, and the current page at the zoom level.
 * `error` when the file is damaged or password protected.
 */
export function usePdfPages(
  file: Blob | null,
  current: number,
  zoom: number,
): {
  thumbnails: (string | undefined)[];
  page: PageImage | undefined;
  error: boolean;
} {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [thumbnails, setThumbnails] = useState<(string | undefined)[]>([]);
  const [page, setPage] = useState<PageImage>();
  const [error, setError] = useState(false);
  // The page on screen: revoked once the next render replaces it.
  const shown = useRef<string>(undefined);

  useEffect(
    () => () => {
      if (shown.current) URL.revokeObjectURL(shown.current);
    },
    [],
  );

  useEffect(() => {
    if (!file) return;
    let alive = true;
    let opened: PDFDocumentProxy | undefined;
    const urls: string[] = [];
    (async () => {
      try {
        opened = await loadPdf(await file.arrayBuffer());
        if (!alive) return;
        setPdf(opened);
        setThumbnails(new Array(opened.numPages).fill(undefined));
        for (let index = 0; index < opened.numPages; index += 1) {
          const thumb = await renderPage(opened, index, THUMB_WIDTH);
          urls.push(thumb.src);
          if (!alive) return;
          setThumbnails((list) =>
            list.map((src, at) => (at === index ? thumb.src : src)),
          );
        }
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => {
      alive = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      void opened?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    renderPage(pdf, current, PAGE_WIDTH * zoom)
      .then((image) => {
        if (!alive) {
          URL.revokeObjectURL(image.src);
          return;
        }
        if (shown.current) URL.revokeObjectURL(shown.current);
        shown.current = image.src;
        // Laid out at its 100 % size times the zoom.
        setPage({
          src: image.src,
          width: image.width / zoom,
          height: image.height / zoom,
        });
      })
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [pdf, current, zoom]);

  return { thumbnails, page, error };
}
