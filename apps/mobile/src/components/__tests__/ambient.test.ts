import { ambientFrame } from "../ambient";

const apply = (m: number[], x: number, y: number) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

describe("ambientFrame", () => {
  it("always hands the native SVG group a numeric matrix, never a string", () => {
    for (const kind of ["sway", "glow", "shimmer", "drift"] as const) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const { matrix } = ambientFrame(kind, [100, 50], t);
        expect(matrix).toHaveLength(6);
        expect(matrix.every((n) => typeof n === "number" && isFinite(n))).toBe(
          true,
        );
      }
    }
  });

  it("sways around its pivot, which stays still", () => {
    const { matrix } = ambientFrame("sway", [100, 50], 0.5);
    const [x, y] = apply(matrix, 100, 50);
    expect(x).toBeCloseTo(100);
    expect(y).toBeCloseTo(50);
    expect(Math.atan2(matrix[1], matrix[0]) * (180 / Math.PI)).toBeCloseTo(1.5);
  });

  it("glows from its centre between 0.92 and 1.12, fading in", () => {
    const start = ambientFrame("glow", [40, 20], 0);
    const peak = ambientFrame("glow", [40, 20], 0.5);
    expect(start.matrix[0]).toBeCloseTo(0.92);
    expect(peak.matrix[0]).toBeCloseTo(1.12);
    expect(apply(peak.matrix, 40, 20)[0]).toBeCloseTo(40);
    expect(start.opacity).toBeCloseTo(0.7);
    expect(peak.opacity).toBeCloseTo(1);
  });

  it("goes there and back over one cycle", () => {
    expect(ambientFrame("drift", [0, 0], 0).matrix[4]).toBeCloseTo(-10);
    expect(ambientFrame("drift", [0, 0], 0.5).matrix[4]).toBeCloseTo(10);
    expect(ambientFrame("drift", [0, 0], 1).matrix[4]).toBeCloseTo(-10);
    expect(ambientFrame("shimmer", [0, 0], 0.5).matrix[4]).toBeCloseTo(4);
    expect(ambientFrame("shimmer", [0, 0], 0.5).opacity).toBeCloseTo(0.35);
  });
});
