import type { PasteTarget } from "@shared/ipc";
import {
  VK_CONTROL,
  VK_MENU,
  VK_SHIFT,
  win32,
  type Hwnd,
} from "../native/win32";

// Where the diagram goes when you press Draw: the window you were typing in when the
// panel opened. The rest of the app only calls the three functions below, so this
// file could later be swapped for a native sidecar without touching anything else.

let target: (PasteTarget & { hwnd: Hwnd }) | null = null;

/**
 * Notes which window has focus right now. Call it just before the panel shows, while
 * your notes app still has focus. Picasso's own windows don't count.
 */
export function rememberTarget(): void {
  target = null;
  const win = win32();
  const hwnd = win?.getForegroundWindow();
  if (!win || !hwnd) return;

  const pid = win.getWindowProcessId(hwnd);
  if (pid === process.pid) return; // opened from Picasso's own main window

  const exe = win.getProcessExeName(pid) ?? "";
  const app = appName(exe);
  target = {
    hwnd,
    title: cleanTitle(win.getWindowTitle(hwnd)) || app,
    app,
    images: imageSupport(exe),
  };
}

/** The remembered window, without its handle (the panel only needs the words). */
export function getTarget(): PasteTarget | null {
  if (!target) return null;
  const { title, app, images } = target;
  return { title, app, images };
}

/**
 * Switches back to the remembered window, hides the panel, and presses Ctrl+V there.
 * Always hides the panel. Returns false when it didn't paste; the diagram is already
 * on the clipboard, so the user can still press Ctrl+V themselves.
 */
export async function pasteIntoTarget(hidePanel: () => void): Promise<boolean> {
  const win = win32();
  const current = target;
  if (
    !win ||
    !current ||
    current.images === "no" ||
    !win.isWindow(current.hwnd)
  ) {
    hidePanel();
    return false;
  }

  // Switch while the panel still has focus: Windows only lets the program you're
  // using hand focus to another window. Once the panel hides, that permission can go.
  win.setForegroundWindow(current.hwnd);
  hidePanel();

  // Give the window a moment, and wait for Ctrl from Ctrl+Enter (and Shift/Alt) to be
  // let go, so the app gets a clean Ctrl+V and not Ctrl+Shift+V (paste as plain text).
  await sleep(80);
  const giveUpAt = Date.now() + 1000;
  while (
    [VK_CONTROL, VK_SHIFT, VK_MENU].some((key) => win.isKeyDown(key)) &&
    Date.now() < giveUpAt
  ) {
    await sleep(20);
  }

  // Never paste into whatever happens to be in front if switching back didn't work.
  if (win.getForegroundWindow() !== current.hwnd) {
    console.warn(
      "[picasso] couldn't switch back to the notes window; copied only",
    );
    return false;
  }
  return win.sendCtrlV();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Programs known to accept pasted images, and ones known to be text-only. Windows can't
// tell us, so these lists are the check. Browsers are a guess: Google Docs and Notion
// take images, but a plain text box on a website won't. Anything else is "unknown", and
// Picasso pastes anyway (the diagram stays on the clipboard either way).
const TAKES_IMAGES = new Set([
  "obsidian.exe",
  "notion.exe",
  "onenote.exe",
  "onenoteim.exe",
  "winword.exe",
  "powerpnt.exe",
  "excel.exe",
  "outlook.exe",
  "olk.exe",
  "ms-teams.exe",
  "teams.exe",
  "slack.exe",
  "discord.exe",
  "mspaint.exe",
  "evernote.exe",
  "logseq.exe",
  "chrome.exe",
  "msedge.exe",
  "firefox.exe",
  "brave.exe",
  "opera.exe",
  "vivaldi.exe",
  "arc.exe",
]);

const TEXT_ONLY = new Set([
  "notepad.exe",
  "notepad++.exe",
  "windowsterminal.exe",
  "cmd.exe",
  "conhost.exe",
  "openconsole.exe",
  "powershell.exe",
  "pwsh.exe",
  "explorer.exe",
]);

function imageSupport(exe: string): PasteTarget["images"] {
  if (TAKES_IMAGES.has(exe)) return "yes";
  if (TEXT_ONLY.has(exe)) return "no";
  return "unknown";
}

const FRIENDLY_NAMES: Record<string, string> = {
  "notepad.exe": "Notepad",
  "notepad++.exe": "Notepad++",
  "windowsterminal.exe": "Terminal",
  "cmd.exe": "Command Prompt",
  "conhost.exe": "the console",
  "openconsole.exe": "the console",
  "powershell.exe": "PowerShell",
  "pwsh.exe": "PowerShell",
  "explorer.exe": "File Explorer",
  "winword.exe": "Word",
  "powerpnt.exe": "PowerPoint",
  "onenote.exe": "OneNote",
  "onenoteim.exe": "OneNote",
  "msedge.exe": "Edge",
  "chrome.exe": "Chrome",
};

/** "obsidian.exe" -> "Obsidian", using a friendlier name where one is known. */
function appName(exe: string): string {
  if (FRIENDLY_NAMES[exe]) return FRIENDLY_NAMES[exe];
  const base = exe.replace(/\.exe$/, "");
  return base ? base[0].toUpperCase() + base.slice(1) : "this app";
}

// Window-title endings that name the app or browser rather than the page or note.
const TITLE_ENDINGS = [
  /\s+[-–—]\s+Google Chrome$/i,
  /\s+[-–—]\s+Microsoft​?\s*Edge$/i, // Edge puts a zero-width space in its name
  /\s+[-–—]\s+(Personal|Work)$/i, // Edge profile names
  /\s+and \d+ more pages?$/i, // Edge with several tabs
  /\s+[-–—]\s+(Mozilla Firefox|Brave|Opera|Vivaldi|Arc)$/i,
  /\s+[-–—]\s+Google (Docs|Sheets|Slides)$/i,
  /\s+[-–—]\s+Obsidian( v[\d.]+)?$/i,
  /\s+[-–—]\s+(Notepad\+\+|Notepad|Word|OneNote|PowerPoint|Notion)$/i,
];

/** "Bio 201 – Lecture 7 - Google Docs - Google Chrome" -> "Bio 201 – Lecture 7" */
function cleanTitle(raw: string): string {
  let title = raw.trim().replace(/^[*●]\s*/, ""); // unsaved-file markers
  let changed = true;
  while (changed) {
    changed = false;
    for (const ending of TITLE_ENDINGS) {
      const next = title.replace(ending, "");
      if (next !== title) {
        title = next.trim();
        changed = true;
      }
    }
  }
  return title.length > 40 ? `${title.slice(0, 39)}…` : title;
}
