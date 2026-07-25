import crypto from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

const originalEncryptionKey = process.env.ENCRYPTION_KEY

describe("encryption configuration", () => {
  afterEach(() => {
    vi.resetModules()
    if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY
    else process.env.ENCRYPTION_KEY = originalEncryptionKey
  })

  it("rejects startup when ENCRYPTION_KEY is missing", async () => {
    delete process.env.ENCRYPTION_KEY
    vi.resetModules()

    await expect(import("../encryption")).rejects.toThrow(
      "ENCRYPTION_KEY must be configured",
    )
  })

  it("rejects ENCRYPTION_KEY values shorter than 32 characters", async () => {
    process.env.ENCRYPTION_KEY = "too-short"
    vi.resetModules()

    await expect(import("../encryption")).rejects.toThrow(
      "ENCRYPTION_KEY must contain at least 32 characters",
    )
  })

  it("round-trips encrypted values with a configured key", async () => {
    process.env.ENCRYPTION_KEY = "test-key-with-at-least-32-characters"
    vi.resetModules()
    const { decrypt, encrypt } = await import("../encryption")

    const encrypted = encrypt("database-password")
    const secondEncrypted = encrypt("database-password")

    expect(encrypted).not.toContain("database-password")
    expect(encrypted.split(":")).toHaveLength(4)
    expect(encrypted.split(":")[0]).not.toBe(secondEncrypted.split(":")[0])
    expect(decrypt(encrypted)).toBe("database-password")
  })

  it("decrypts the legacy fixed-salt three-part format", async () => {
    const secret = "test-key-with-at-least-32-characters"
    process.env.ENCRYPTION_KEY = secret
    vi.resetModules()
    const { decrypt } = await import("../encryption")
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      crypto.scryptSync(secret, "salt", 32),
      iv,
    )
    const encrypted = cipher.update("legacy-password", "utf8", "hex") + cipher.final("hex")
    const legacyValue = `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted}`

    expect(decrypt(legacyValue)).toBe("legacy-password")
  })
})
