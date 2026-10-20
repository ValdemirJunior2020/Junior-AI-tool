import { randomBytes } from "node:crypto";
import { mkdir, writeFile, rename, rm, readFile } from "node:fs/promises";
import path from "node:path";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const RETRYABLE = new Set(["EPERM", "EACCES", "EBUSY"]);
// Serialize writes per status path so an older snapshot cannot overwrite a newer one.
const writers = new Map();

export function saveBuilderStatus(destination, data) {
  const previous = writers.get(destination) || Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = destination + "." + randomBytes(8).toString("hex") + ".tmp";
    try {
      await writeFile(temporary, JSON.stringify(data, null, 2), { flag: "wx" });
      for (let attempt = 0; attempt < 9; attempt++) {
        try {
          await rename(temporary, destination);
          return;
        } catch (error) {
          if (!RETRYABLE.has(error.code) || attempt === 8) throw error;
          await sleep(Math.min(1200, 70 * 2 ** attempt));
        }
      }
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  });
  writers.set(destination, next);
  void next.finally(() => {
    if (writers.get(destination) === next) writers.delete(destination);
  }).catch(() => {});
  return next;
}

export async function readBuilderStatus(destination) {
  try { return JSON.parse(await readFile(destination, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
