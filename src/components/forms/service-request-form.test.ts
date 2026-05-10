import { describe, it, expect, vi } from "vitest";
import { submitServiceRequest } from "./service-request-form";

const validData = {
  type: "trouble_ticket" as const,
  name: "Budi",
  phone: "081234567890",
  description: "Internet mati sejak pagi.",
};

function makeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  ) as unknown as typeof fetch;
}

describe("submitServiceRequest", () => {
  it("POSTs JSON to /api/service-requests on success", async () => {
    const fetchMock = makeFetch(201, { data: { id: 1, ticketNumber: "TKT-2026-05-0001" } });
    await submitServiceRequest(validData, fetchMock);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/service-requests");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      type: "trouble_ticket",
      phone: "081234567890",
    });
  });

  it("throws server-provided error on 4xx (real message, not fake success)", async () => {
    const fetchMock = makeFetch(400, { error: "Validation Error" });
    await expect(submitServiceRequest(validData, fetchMock)).rejects.toThrow(
      "Validation Error"
    );
  });

  it("throws fallback message when server returns no body", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(submitServiceRequest(validData, fetchMock)).rejects.toThrow(
      /HTTP 503/
    );
  });

  it("propagates network failure", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    await expect(submitServiceRequest(validData, fetchMock)).rejects.toThrow(
      "network down"
    );
  });
});
