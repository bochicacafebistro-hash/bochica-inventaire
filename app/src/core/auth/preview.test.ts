import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/firebase", () => ({ auth: {}, db: {} }));
vi.mock("firebase/auth", () => ({}));
vi.mock("firebase/firestore", () => ({}));

describe("mode aperçu admin", async () => {
  const { withPreview } = await import("./AuthContext");
  const admin = { uid: "a", email: "bochica@x", role: "global_admin" as const };
  it("l'admin peut voir l'app comme le chef ou l'employé", () => {
    expect(withPreview(admin, "employee")).toMatchObject({ role: "employee", realRole: "global_admin" });
    expect(withPreview(admin, "chef").role).toBe("chef");
    expect(withPreview(admin, null)).toMatchObject({ role: "global_admin", realRole: "global_admin" });
  });
  it("un chef ou un employé ne peut jamais changer de rôle", () => {
    expect(withPreview({ ...admin, role: "employee" }, "chef").role).toBe("employee");
    expect(withPreview({ ...admin, role: "chef" }, "employee").role).toBe("chef");
  });
});
