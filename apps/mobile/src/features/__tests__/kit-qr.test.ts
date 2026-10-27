import { decodeKitQr, encodeKitQr } from "../kit-qr";

const phrase = Array.from({ length: 24 }, (_, i) =>
  String.fromCharCode(97 + (i % 26)).repeat(4),
);

describe("kit QR", () => {
  it("round-trips the 24 words", () => {
    expect(decodeKitQr(encodeKitQr(phrase))).toBe(phrase.join(" "));
  });

  it("shows no readable word in the payload", () => {
    const payload = encodeKitQr(phrase);
    expect(payload.startsWith("keeplas-kit:1:")).toBe(true);
    expect(payload).not.toContain(phrase.join(" "));
    expect(payload).not.toContain(" ");
  });

  it("rejects anything that isn't a Keeplas kit", () => {
    expect(decodeKitQr(phrase.join(" "))).toBeNull();
    expect(decodeKitQr("https://app.keeplas.com/link/abc")).toBeNull();
    expect(decodeKitQr("keeplas-kit:2:" + "x")).toBeNull();
    expect(decodeKitQr("keeplas-kit:1:%%%")).toBeNull();
    expect(decodeKitQr(encodeKitQr(phrase.slice(0, 23)))).toBeNull();
    expect(
      decodeKitQr(encodeKitQr([...phrase.slice(0, 23), "Bad1"])),
    ).toBeNull();
  });
});
