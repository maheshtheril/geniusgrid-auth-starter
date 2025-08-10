import crypto from "crypto";

// 32 bytes raw -> base64url (no '+','/','=')
export function newRawToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}
