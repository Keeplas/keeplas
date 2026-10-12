import {
  AUDIT_CONTEXT_REFRESH_MS,
  createAuditContextSource,
  fetchAuditContext,
  type AuditContext,
} from "../audit-context";

const sealed = (ts: number): AuditContext => ({
  ip: "1.2.3.4",
  country: "CA",
  ts,
  sig: "c2ln",
});

describe("audit context cache", () => {
  it("fetches once and reuses the seal within the hour", async () => {
    let now = 0;
    const fetchContext = jest.fn(async () => sealed(now));
    const source = createAuditContextSource(fetchContext, () => now);

    await source.get();
    now += AUDIT_CONTEXT_REFRESH_MS - 1;
    await source.get();
    expect(fetchContext).toHaveBeenCalledTimes(1);
  });

  it("refreshes once the seal is older than an hour", async () => {
    let now = 0;
    const fetchContext = jest.fn(async () => sealed(now));
    const source = createAuditContextSource(fetchContext, () => now);

    await source.get();
    now += AUDIT_CONTEXT_REFRESH_MS;
    expect((await source.get()).ts).toBe(AUDIT_CONTEXT_REFRESH_MS);
    expect(fetchContext).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent callers", async () => {
    const fetchContext = jest.fn(async () => sealed(1));
    const source = createAuditContextSource(fetchContext);
    await Promise.all([source.get(), source.get(), source.get()]);
    expect(fetchContext).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure and refetches after clear()", async () => {
    const fetchContext = jest
      .fn<Promise<AuditContext>, []>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(sealed(2));
    const source = createAuditContextSource(fetchContext);
    await expect(source.get()).rejects.toThrow("offline");
    await source.get();
    source.clear();
    await source.get();
    expect(fetchContext).toHaveBeenCalledTimes(3);
  });
});

describe("fetchAuditContext", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("reads the sealed JSON from GET /api/context", async () => {
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () => sealed(5),
    })) as unknown as typeof fetch;
    await expect(fetchAuditContext("https://app.keeplas.com")).resolves.toEqual(
      sealed(5),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      "https://app.keeplas.com/api/context",
      expect.anything(),
    );
  });

  it("rejects a 204 (no secret configured) and malformed bodies", async () => {
    global.fetch = jest.fn(async () => ({
      status: 204,
    })) as unknown as typeof fetch;
    await expect(fetchAuditContext("https://x")).rejects.toThrow("unavailable");
    global.fetch = jest.fn(async () => ({
      status: 200,
      json: async () => ({ ip: "1" }),
    })) as unknown as typeof fetch;
    await expect(fetchAuditContext("https://x")).rejects.toThrow("Malformed");
  });
});
