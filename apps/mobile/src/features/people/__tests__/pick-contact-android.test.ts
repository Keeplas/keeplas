import { pickPhone } from "../../../../modules/contact-picker";
import { pickContact } from "../pick-contact.android";

jest.mock("../../../../modules/contact-picker", () => ({
  pickPhone: jest.fn(),
}));

const picked = jest.mocked(pickPhone);

describe("pickContact (Android)", () => {
  it("keeps the name and the picked number, read from its dial code", async () => {
    picked.mockResolvedValue({ name: "Marie Dupont", number: "+447400123456" });
    expect(await pickContact("FR")).toEqual({
      name: "Marie Dupont",
      email: "",
      phones: [{ label: "", country: "GB", number: "7400 123456" }],
    });
  });

  it("reads a number without a dial code in the current country", async () => {
    picked.mockResolvedValue({
      name: "Marie Dupont",
      number: "06 12 34 56 78",
    });
    const contact = await pickContact("FR");
    expect(contact?.phones).toEqual([
      { label: "", country: "FR", number: "6 12 34 56 78" },
    ]);
  });

  it("returns null when the user backs out", async () => {
    picked.mockResolvedValue(null);
    expect(await pickContact("FR")).toBeNull();
  });

  it("copes with a row that has no name or number", async () => {
    picked.mockResolvedValue({ name: null, number: null });
    expect(await pickContact("FR")).toEqual({
      name: "",
      email: "",
      phones: [],
    });
  });
});
