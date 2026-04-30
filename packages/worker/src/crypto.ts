import { createDecipheriv } from "crypto";

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
