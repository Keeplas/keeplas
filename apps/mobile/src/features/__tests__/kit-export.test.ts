import { kitPdfHtml } from "../kit-export";

jest.mock("expo-print", () => ({}));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-file-system", () => ({}));
jest.mock("react-native-view-shot", () => ({}));

const phrase = Array.from({ length: 24 }, (_, i) => `word${i + 1}`);

describe("kitPdfHtml", () => {
  it("lists the 24 words in order, numbered", () => {
    const html = kitPdfHtml(
      phrase,
      { title: "Kit", created: "", qr: "", rules: [] },
      "",
    );
    const positions = phrase.map((word) => html.indexOf(`</small>${word}<`));
    expect(positions.every((at) => at > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html).toContain("<small>01</small>word1<");
    expect(html).toContain("<small>24</small>word24<");
  });

  it("escapes the translated labels", () => {
    const html = kitPdfHtml(
      phrase,
      {
        title: "Votre kit d'accès <b>",
        created: "Créé le 26 oct.",
        qr: "",
        rules: ["A & B"],
      },
      "",
    );
    expect(html).toContain("Votre kit d&#39;accès &lt;b&gt;");
    expect(html).toContain("<li>A &amp; B</li>");
  });

  it("shows the QR code with its escaped caption", () => {
    const html = kitPdfHtml(
      phrase,
      { title: "Kit", created: "", qr: "Scan <me>", rules: [] },
      '<svg id="kit-qr"></svg>',
    );
    expect(html).toContain('<svg id="kit-qr"></svg><p>Scan &lt;me&gt;</p>');
  });
});
