import { app, safeStorage } from "electron";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result } from "@shared/ipc";

// Lives in Picasso's own folder (%APPDATA%/picasso), never in the project.
const apiKeyPath = (): string => join(app.getPath("userData"), "apiKey.bin");

export async function saveApiKey(key: unknown): Promise<Result> {
  // Anything can arrive over IPC, so check it here instead of trusting the renderer.
  const trimmed = typeof key === "string" ? key.trim() : "";
  if (!trimmed) return { ok: false, error: "Paste an API key first." };
  if (/\s/.test(trimmed))
    return {
      ok: false,
      error: "API keys don't contain spaces. Check what you pasted.",
    };
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error:
        "Windows encryption isn't available, so the key can't be stored safely.",
    };
  }

  // safeStorage encrypts with the current Windows account, so the file is useless on any other.
  await writeFile(apiKeyPath(), safeStorage.encryptString(trimmed));
  return { ok: true };
}

export async function clearApiKey(): Promise<void> {
  await rm(apiKeyPath(), { force: true });
}

export async function hasApiKey(): Promise<boolean> {
  return (await readApiKey()) !== null;
}

/** For the main process only (the AI calls). Never expose this over IPC. */
export async function readApiKey(): Promise<string | null> {
  try {
    return safeStorage.decryptString(await readFile(apiKeyPath()));
  } catch {
    // No key saved yet, or the file can't be decrypted on this Windows account.
    return null;
  }
}
