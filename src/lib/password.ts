import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, scryptOptions, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

/**
 * Hashes a plain text password using scrypt with a unique random salt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6 || password.length > 128) {
    throw new Error("Mật khẩu phải từ 6 đến 128 ký tự.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

/**
 * Verifies a plain text password against an scrypt stored salt:hash
 */
export async function verifyPassword(
  password: unknown,
  stored?: string | null,
): Promise<boolean> {
  if (typeof password !== "string" || !password || password.length > 128) {
    return false;
  }
  if (!stored) return false;

  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  try {
    const key = await deriveKey(password, salt);
    return timingSafeEqual(key, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}
