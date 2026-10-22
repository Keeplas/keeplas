import { captureDepth } from "../capture-depth";

describe("captureDepth", () => {
  it("pops every capture screen on top of the stack", () => {
    expect(captureDepth(["(tabs)", "capture/compose"])).toBe(1);
    expect(captureDepth(["(tabs)", "capture/compose", "capture/compose"])).toBe(
      2,
    );
    expect(captureDepth(["(tabs)", "item/[id]", "capture/compose"])).toBe(1);
  });

  it("stops at the first screen outside the capture flow", () => {
    expect(captureDepth(["capture/compose", "item/[id]"])).toBe(0);
  });
});
