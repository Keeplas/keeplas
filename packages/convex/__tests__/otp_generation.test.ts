import { afterEach, describe, expect, it, vi } from "vitest";
import { ResendOTP } from "../ResendOTP";
import { generateOtp } from "../lib/otp";

// 2^32 is not a multiple of 10^6: a plain modulo would favour the low codes.
// Draws from the incomplete top range are thrown away and drawn again.

/** Make crypto.getRandomValues yield these 32-bit words, one per call. */
function drawWords(...words: number[]) {
  const spy = vi.spyOn(crypto, "getRandomValues");
  for (const word of words) {
    spy.mockImplementationOnce(<T extends ArrayBufferView | null>(array: T) => {
      new Uint32Array((array as ArrayBufferView).buffer).fill(word);
      return array;
    });
  }
  return spy;
}

describe("one-time code generation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redraws a word from the biased top range", () => {
    const spy = drawWords(0xffffffff, 4_294_000_000, 1_000_007);
    expect(generateOtp()).toBe("000007");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("issues the email verification code from the same generator", async () => {
    drawWords(0xffffffff, 123_456);
    const generate = ResendOTP.options.generateVerificationToken!;
    expect(await generate()).toBe("123456");
  });
});
