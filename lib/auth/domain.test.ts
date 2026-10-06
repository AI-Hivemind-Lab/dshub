import { describe, expect, it } from "vitest";
import { isAllowedEmail } from "./domain";

describe("isAllowedEmail", () => {
  it("accepts the company domain, case-insensitively", () => {
    expect(isAllowedEmail("toainguyen@anduintransact.com", "anduintransact.com")).toBe(true);
    expect(isAllowedEmail("ToaiNguyen@AnduinTransact.com", "anduintransact.com")).toBe(true);
  });
  it("rejects other domains and look-alikes", () => {
    expect(isAllowedEmail("x@gmail.com", "anduintransact.com")).toBe(false);
    expect(isAllowedEmail("x@evil-anduintransact.com", "anduintransact.com")).toBe(false);
    expect(isAllowedEmail("x@anduintransact.com.evil.io", "anduintransact.com")).toBe(false);
  });
  it("rejects missing emails", () => {
    expect(isAllowedEmail(undefined, "anduintransact.com")).toBe(false);
    expect(isAllowedEmail(null, "anduintransact.com")).toBe(false);
  });
});
