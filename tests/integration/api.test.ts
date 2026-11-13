import { describe, expect, it, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  listEvents: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/server/api-auth", () => ({
  authenticateApiRequest: mocks.authenticateApiRequest,
  apiError: (error: unknown) => Response.json({ ok: false, error: error instanceof Error ? error.message : "error" }, { status: 500 }),
}));
vi.mock("@/server/queries", () => ({ listEvents: mocks.listEvents }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRawUnsafe: mocks.queryRaw } }));

import { GET as health } from "@/app/api/health/route";
import { GET as listEventsRoute } from "@/app/api/v1/events/route";

describe("REST API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "";
  });

  it("health endpoint melaporkan database sehat", async () => {
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);
    const response = await health();
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; checks: { database: string } };
    expect(body.ok).toBe(true);
    expect(body.checks.database).toBe("ok");
  });

  it("health endpoint mengembalikan 503 saat database gagal", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("db down"));
    const response = await health();
    expect(response.status).toBe(503);
  });

  it("GET /api/v1/events mensyaratkan scope dan mengembalikan data tenant", async () => {
    mocks.authenticateApiRequest.mockResolvedValue({ tenantId: "tenant-a", apiKeyId: "key-1", scopes: ["events.read"] });
    mocks.listEvents.mockResolvedValue([{ id: "e1", slug: "acara", title: "Acara" }]);
    const response = await listEventsRoute(new Request("http://localhost/api/v1/events"));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; data: { id: string }[] };
    expect(body.ok).toBe(true);
    expect(body.data[0]?.id).toBe("e1");
    expect(mocks.listEvents).toHaveBeenCalledWith("tenant-a");
  });

  it("GET /api/v1/events menolak autentikasi gagal", async () => {
    mocks.authenticateApiRequest.mockRejectedValue(new Error("API_KEY_INVALID"));
    const response = await listEventsRoute(new Request("http://localhost/api/v1/events"));
    expect(response.status).toBe(500);
  });
});
