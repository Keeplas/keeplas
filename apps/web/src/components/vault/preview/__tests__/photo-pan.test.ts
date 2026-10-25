import { describe, expect, it } from "vitest";
import { clampPan } from "../photo-gallery";

describe("photo pan", () => {
  const stage = { width: 800, height: 600 };

  it("lets a zoomed photo move up to its edges, not past them", () => {
    expect(clampPan({ x: 1000, y: -1000 }, 3, stage)).toEqual({
      x: 800,
      y: -600,
    });
    expect(clampPan({ x: 120, y: 40 }, 2, stage)).toEqual({ x: 120, y: 40 });
  });

  it("keeps an unzoomed photo centered", () => {
    expect(clampPan({ x: 50, y: 50 }, 1, stage)).toEqual({ x: 0, y: 0 });
  });
});
