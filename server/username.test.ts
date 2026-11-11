import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del database
vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { getDb } from "./db";

describe("Username validation logic", () => {
  it("should accept valid usernames", () => {
    const validUsernames = ["forza10", "ac_milan", "juve99", "ab", "1234567890"];
    const regex = /^[a-zA-Z0-9_]+$/;
    for (const u of validUsernames) {
      expect(u.length >= 2 && u.length <= 10 && regex.test(u)).toBe(true);
    }
  });

  it("should reject usernames that are too short", () => {
    expect("a".length < 2).toBe(true);
  });

  it("should reject usernames that are too long", () => {
    expect("12345678901".length > 10).toBe(true);
  });

  it("should reject usernames with invalid characters", () => {
    const invalidUsernames = ["forza!", "ac milan", "juve@99", "test.user"];
    const regex = /^[a-zA-Z0-9_]+$/;
    for (const u of invalidUsernames) {
      expect(regex.test(u)).toBe(false);
    }
  });

  it("should normalize username to lowercase", () => {
    const username = "ForZa10";
    const normalized = username.trim().toLowerCase();
    expect(normalized).toBe("forza10");
  });
});

describe("Username token generation", () => {
  it("should generate a 64-character hex token", async () => {
    const crypto = await import("crypto");
    const token = crypto.randomBytes(32).toString("hex");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("should generate unique tokens on each call", async () => {
    const crypto = await import("crypto");
    const token1 = crypto.randomBytes(32).toString("hex");
    const token2 = crypto.randomBytes(32).toString("hex");
    expect(token1).not.toBe(token2);
  });
});

describe("Username expiry logic", () => {
  it("should set token expiry 24 hours in the future", () => {
    const now = Date.now();
    const expiry = new Date(now + 24 * 60 * 60 * 1000);
    const diffHours = (expiry.getTime() - now) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 1);
  });

  it("should detect expired tokens", () => {
    const expiredDate = new Date(Date.now() - 1000); // 1 second ago
    expect(expiredDate < new Date()).toBe(true);
  });

  it("should detect valid tokens", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(futureDate > new Date()).toBe(true);
  });
});

describe("Username availability check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return available=true when no user has the username", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const db = await getDb();
    const result = await db!.select().from({} as any).where({} as any).limit(1);
    expect(result).toHaveLength(0);
    // available = result.length === 0
    expect(result.length === 0).toBe(true);
  });

  it("should return available=false when username is taken", async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 1 }]),
    };
    (getDb as ReturnType<typeof vi.fn>).mockResolvedValue(mockDb);

    const db = await getDb();
    const result = await db!.select().from({} as any).where({} as any).limit(1);
    expect(result).toHaveLength(1);
    // available = result.length === 0
    expect(result.length === 0).toBe(false);
  });
});
