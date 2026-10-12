import { describe, it, expect } from "vitest";

describe("HTTPS configuration", () => {
  it("defaults FORCE_HTTPS to false in development", () => {
    expect(process.env.FORCE_HTTPS === "true").toBe(false);
  });
});
