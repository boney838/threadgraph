import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export function encryptApiKey(plaintext: string, secret: string) {
  const iv = randomBytes(16);
  const key = Buffer.from(secret, "hex");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString("hex"),
    iv: iv.toString("hex"),
  };
}

export function decryptApiKey(
  encryptedHex: string,
  ivHex: string,
  secret: string
): string {
  const key = Buffer.from(secret, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const data = Buffer.from(encryptedHex, "hex");
  const authTag = data.subarray(data.length - 16);
  const ciphertext = data.subarray(0, data.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
