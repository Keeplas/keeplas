import {
  isResumable,
  RESUME_MAX_AGE_MS,
  resumeTarget,
  type ResumePoint,
} from "../resume-point";

jest.mock("expo-secure-store", () => ({}));

const NOW = 1_000_000_000;
const at = (pathname: string, ago = 0, params = {}): ResumePoint => ({
  pathname,
  params,
  at: NOW - ago,
});

describe("resume after unlock", () => {
  it("reopens the screen the app showed when it locked", () => {
    expect(
      resumeTarget(at("/item/edit", 60_000, { id: "i1" }), false, NOW),
    ).toEqual({
      pathname: "/item/edit",
      params: { id: "i1" },
    });
    expect(resumeTarget(at("/capture/compose"), false, NOW)).toEqual({
      pathname: "/capture/compose",
      params: {},
    });
  });

  it("goes home when the saved screen is more than an hour old", () => {
    expect(
      resumeTarget(at("/capture/compose", RESUME_MAX_AGE_MS + 1), false, NOW),
    ).toBeNull();
  });

  it("keeps an unfinished setup on its step, however long ago", () => {
    expect(resumeTarget(at("/kit", 2 * RESUME_MAX_AGE_MS), true, NOW)).toEqual({
      pathname: "/kit",
      params: {},
    });
    expect(resumeTarget(at("/add-contact"), true, NOW)).toBeNull();
    expect(resumeTarget(at("/contacts"), true, NOW)).toBeNull();
  });

  it("never mixes setup steps and app screens", () => {
    expect(resumeTarget(at("/item/edit"), true, NOW)).toBeNull();
    expect(resumeTarget(at("/done"), false, NOW)).toBeNull();
    expect(resumeTarget(null, true, NOW)).toBeNull();
  });

  it("does not record screens that only pass through", () => {
    expect(isResumable("/unlock")).toBe(false);
    expect(isResumable("/home")).toBe(false);
    expect(isResumable("/capture/securing")).toBe(false);
    expect(isResumable("/contacts")).toBe(true);
    expect(isResumable("/item/abc")).toBe(true);
  });

  it("does not reopen a recorder or a scanner, nor a recovery approval", () => {
    expect(isResumable("/capture/voice")).toBe(false);
    expect(isResumable("/capture/scan")).toBe(false);
    expect(isResumable("/recovery-approval/abc")).toBe(false);
    expect(isResumable("/capture/compose")).toBe(true);
  });
});
