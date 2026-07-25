import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const LEGACY_SALT = 'salt'
const SALT_BYTES = 16
const configuredEncryptionSecret = process.env.ENCRYPTION_KEY

if (!configuredEncryptionSecret) {
  throw new Error('ENCRYPTION_KEY must be configured')
}
if (configuredEncryptionSecret.length < 32) {
  throw new Error('ENCRYPTION_KEY must contain at least 32 characters')
}
const ENCRYPTION_SECRET: string = configuredEncryptionSecret

export function encrypt(text: string): string {
  const salt = crypto.randomBytes(SALT_BYTES)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(salt), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(':')
  const [salt, ivHex, authTagHex, encrypted] = parts.length === 4
    ? [Buffer.from(parts[0], 'hex'), parts[1], parts[2], parts[3]]
    : [LEGACY_SALT, parts[0], parts[1], parts[2]]

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(salt), iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

function deriveKey(salt: crypto.BinaryLike): Buffer {
  return crypto.scryptSync(ENCRYPTION_SECRET, salt, 32)
}
