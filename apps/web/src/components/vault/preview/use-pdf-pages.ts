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
 * `error` when the file is damaged or password protected. State belongs to
 * the file it was made for, so another file starts clean.
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
  const [doc, setDoc] = useState<{ file: Blob; pdf: PDFDocumentProxy }>();
  const [thumbs, setThumbs] = useState<{
    file: Blob;
    list: (string | undefined)[];
  }>();
  const [shownPage, setShownPage] = useState<{
    file: Blob;
    image: PageImage;
  }>();
  const [failed, setFailed] = useState<Blob | null>(null);
  // The page on screen: revoked once the next render replaces it.
  const shown = useRef<string>(undefined);
  const pdf = doc && doc.file === file ? doc.pdf : undefined;

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
        setDoc({ file, pdf: opened });
        setThumbs({ file, list: new Array(opened.numPages).fill(undefined) });
        for (let index = 0; index < opened.numPages; index += 1) {
          const thumb = await renderPage(opened, index, THUMB_WIDTH);
          if (!alive) {
            URL.revokeObjectURL(thumb.src);
            return;
          }
          urls.push(thumb.src);
          setThumbs((state) =>
            state?.file === file
              ? {
                  file,
                  list: state.list.map((src, at) =>
                    at === index ? thumb.src : src,
                  ),
                }
              : state,
          );
        }
      } catch {
        if (alive) setFailed(file);
      }
    })();
    return () => {
      alive = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
      void opened?.destroy();
    };
  }, [file]);

  useEffect(() => {
    if (!pdf || !file) return;
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
        setShownPage({
          file,
          image: {
            src: image.src,
            width: image.width / zoom,
            height: image.height / zoom,
          },
        });
      })
      .catch(() => alive && setFailed(file));
    return () => {
      alive = false;
    };
  }, [pdf, file, current, zoom]);

  return {
    thumbnails: thumbs?.file === file ? thumbs.list : [],
    page: shownPage?.file === file ? shownPage.image : undefined,
    error: failed !== null && failed === file,
  };
}
