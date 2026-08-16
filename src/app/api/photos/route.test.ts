import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/session", () => ({
  getAllowedSession: vi.fn(),
}));

vi.mock("@/lib/places", () => ({
  createPlacesClient: () => ({
    fetchPhoto: async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    }),
  }),
}));

import { getAllowedSession } from "@/lib/session";

describe("GET /api/photos", () => {
  it("returns 401 without a session", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: false,
      reason: "unauthenticated",
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 for a signed-in email that is not invited", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: false,
      reason: "not_invited",
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(403);
  });

  it("returns bytes for an allowlisted session", async () => {
    vi.mocked(getAllowedSession).mockResolvedValue({
      ok: true,
      user: { id: "u1", email: "ada@x.com", name: "Ada" },
    });
    const res = await GET(
      new Request("http://localhost/api/photos?name=places/x/photos/y"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
  });
});
