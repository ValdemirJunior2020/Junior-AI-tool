import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function newTotpSecret() {
  const bytes = randomBytes(20);
  let acc = 0, count = 0, output = "";
  for (const b of bytes) {
    acc = (acc << 8) | b; count += 8;
    while (count >= 5) { count -= 5; output += ABC[(acc >>> count) & 31]; }
  }
  return output;
}
function decode32(value) {
  let bits = 0, count = 0;
  const out = [];
  for (const char of value.toUpperCase()) {
    const i = ABC.indexOf(char);
    if (i < 0) return Buffer.alloc(0);
    bits = (bits << 5) | i; count += 5;
    if (count >= 8) { count -= 8; out.push((bits >>> count) & 255); }
  }
  return Buffer.from(out);
}
export function codeFor(secret, timestamp = Date.now()) {
  const key = decode32(secret);
  if (!key.length) return "";
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[19] & 15;
  return ((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}
export function verifyTotp(secret, candidate) {
  if (!/^\d{6}$/.test(String(candidate || "")) || !secret) return false;
  const userCode = Buffer.from(String(candidate));
  for (const drift of [-30000, 0, 30000]) {
    const expected = Buffer.from(codeFor(secret, Date.now() + drift));
    if (expected.length === userCode.length && timingSafeEqual(userCode, expected)) return true;
  }
  return false;
}
