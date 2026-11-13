import { describe, expect, it } from "vitest";
import { assertEventAccess, canAccessEvent, effectiveRole, hasPermission, ROLE_PERMISSIONS } from "@/lib/rbac";

describe("RBAC & ownership", () => {
  it("Super Admin memiliki semua izin; guest tidak punya izin", () => {
    expect(hasPermission("SUPER_ADMIN", "tenant.suspend")).toBe(true);
    expect(ROLE_PERMISSIONS.GUEST).toHaveLength(0);
  });

  it("owner acara tidak bisa mengakses acara tenant lain", () => {
    expect(canAccessEvent({ role: "EVENT_OWNER", eventIds: [], tenantId: "tenant-a" }, { id: "e1", tenantId: "tenant-a" })).toBe(true);
    expect(canAccessEvent({ role: "EVENT_OWNER", eventIds: [], tenantId: "tenant-a" }, { id: "e2", tenantId: "tenant-b" })).toBe(false);
  });

  it("panitia hanya mengakses event yang diberikan", () => {
    expect(canAccessEvent({ role: "CHECKIN_STAFF", eventIds: ["e1"], tenantId: "t1" }, { id: "e1", tenantId: "t1" })).toBe(true);
    expect(() => assertEventAccess({ role: "CHECKIN_STAFF", eventIds: ["e1"], tenantId: "t1" }, { id: "e2", tenantId: "t1" }, "checkin.write")).toThrow();
  });

  it("role tertinggi menang & platform super admin meng-override membership", () => {
    expect(effectiveRole(["EDITOR", "TENANT_ADMIN"])).toBe("TENANT_ADMIN");
    expect(effectiveRole(["EDITOR"], "SUPER_ADMIN")).toBe("SUPER_ADMIN");
  });
});
