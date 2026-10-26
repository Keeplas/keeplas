import { describe, expect, it } from "vitest";
import { assertPinShape, validatePin } from "../device-unlock/pin";

describe("validatePin", () => {
  it("accepts a 4-digit PIN", () => {
    expect(() => validatePin("0427")).not.toThrow();
  });

  it.each(["123", "12345", "123456", "12a4", ""])("rejects %j", (pin) => {
    expect(() => validatePin(pin)).toThrow();
  });
});

describe("assertPinShape", () => {
  it.each(["0427", "123456", "12345678"])("lets %j try to unlock", (pin) => {
    expect(() => assertPinShape(pin)).not.toThrow();
  });

  it.each(["123", "12a4"])("rejects %j", (pin) => {
    expect(() => assertPinShape(pin)).toThrow();
  });
});
