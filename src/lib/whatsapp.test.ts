import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFonnteConfig } = vi.hoisted(() => ({ getFonnteConfig: vi.fn() }));
vi.mock("@/lib/settings", () => ({ getFonnteConfig }));

import { sendWhatsApp } from "./whatsapp";

beforeEach(() => {
  getFonnteConfig.mockReset();
});

type FetchMock = ReturnType<typeof vi.fn>;

describe("sendWhatsApp", () => {
  it("returns mock when no token configured (does not call fetch)", async () => {
    getFonnteConfig.mockResolvedValue({
      apiUrl: "https://api.fonnte.com/send",
      token: "",
    });
    const fetchMock: FetchMock = vi.fn();

    const r = await sendWhatsApp(
      "0812",
      "halo",
      fetchMock as unknown as typeof fetch
    );
    expect(r.status).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts JSON to Fonnte and parses response on 2xx", async () => {
    getFonnteConfig.mockResolvedValue({
      apiUrl: "https://api.fonnte.com/send",
      token: "tok",
    });
    const fetchMock: FetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ status: true, msg: "ok" }), {
          status: 200,
        })
    );

    const r = await sendWhatsApp(
      "081234",
      "halo",
      fetchMock as unknown as typeof fetch
    );
    expect(r).toEqual({ status: true, msg: "ok" });

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe("https://api.fonnte.com/send");
    expect(call[1].method).toBe("POST");
    const body = JSON.parse(call[1].body as string);
    expect(body).toEqual({ target: "081234", message: "halo" });
  });

  it("throws on non-2xx response", async () => {
    getFonnteConfig.mockResolvedValue({
      apiUrl: "https://api.fonnte.com/send",
      token: "tok",
    });
    const fetchMock: FetchMock = vi.fn(
      async () => new Response("nope", { status: 500, statusText: "boom" })
    );
    await expect(
      sendWhatsApp("0812", "halo", fetchMock as unknown as typeof fetch)
    ).rejects.toThrow(/Fonnte API error 500/);
  });

  it("aborts after timeout and rejects (does not hang)", async () => {
    getFonnteConfig.mockResolvedValue({
      apiUrl: "https://api.fonnte.com/send",
      token: "tok",
    });

    // Fake fetch that rejects only when the AbortSignal fires.
    const fetchMock: FetchMock = vi.fn(
      (_url: unknown, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const onAbort = () => {
            const err = new Error("aborted") as Error & { name: string };
            err.name = "AbortError";
            reject(err);
          };
          if (init.signal?.aborted) onAbort();
          else init.signal?.addEventListener("abort", onAbort, { once: true });
        })
    );

    const start = Date.now();
    await expect(
      sendWhatsApp("0812", "halo", fetchMock as unknown as typeof fetch, 50)
    ).rejects.toThrow(/aborted/);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
