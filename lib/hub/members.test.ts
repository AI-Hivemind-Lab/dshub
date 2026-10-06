import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache/ttl-cache";
import { createMemberResolver } from "./members";

const members = [{ id: 42, username: "Toai", email: "ToaiNguyen@anduintransact.com" }];

describe("createMemberResolver", () => {
  it("matches emails case-insensitively and caches the list", async () => {
    const listMembers = vi.fn(async () => members);
    const resolve = createMemberResolver({ listMembers }, new TtlCache(60_000));
    expect(await resolve("toainguyen@anduintransact.com")).toEqual(members[0]);
    expect(await resolve("TOAINGUYEN@anduintransact.com")).toEqual(members[0]);
    expect(listMembers).toHaveBeenCalledTimes(1);
  });
  it("returns null for an unknown email", async () => {
    const resolve = createMemberResolver({ listMembers: async () => members }, new TtlCache(60_000));
    expect(await resolve("someone@anduintransact.com")).toBeNull();
  });
});
