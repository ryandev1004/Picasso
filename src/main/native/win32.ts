import koffi from "koffi";

// The few Windows (user32/kernel32) functions auto-paste needs, called through koffi.
// Declarations follow koffi's docs (koffi.dev/load, /pointers, /output, /composites).
// Loaded on first use; if loading fails, win32() returns null and Picasso only copies.

/** A window handle. koffi hands these back as BigInts, so `===` compares them. */
export type Hwnd = bigint;

interface Win32 {
  /** The window that has keyboard focus right now, or null. */
  getForegroundWindow(): Hwnd | null;
  getWindowTitle(hwnd: Hwnd): string;
  /** The id of the process (program) that owns the window. */
  getWindowProcessId(hwnd: Hwnd): number;
  /** The program's file name in lower case, like "obsidian.exe", or null if Windows won't say. */
  getProcessExeName(pid: number): string | null;
  isWindow(hwnd: Hwnd): boolean;
  setForegroundWindow(hwnd: Hwnd): boolean;
  isKeyDown(virtualKey: number): boolean;
  /** Presses and releases Ctrl+V. Returns whether all four key events were sent. */
  sendCtrlV(): boolean;
}

export const VK_SHIFT = 0x10;
export const VK_CONTROL = 0x11;
export const VK_MENU = 0x12; // Alt
const VK_V = 0x56;
const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
// Room for window titles and program paths, in characters.
const MAX_CHARS = 512;

let cached: Win32 | null | undefined; // undefined = not loaded yet

export function win32(): Win32 | null {
  if (cached !== undefined) return cached;
  if (process.platform !== "win32") return (cached = null);
  try {
    cached = load();
  } catch (error) {
    console.error(
      "[picasso] auto-paste is off: couldn't load the Windows functions:",
      error,
    );
    cached = null;
  }
  return cached;
}

function load(): Win32 {
  const user32 = koffi.load("user32.dll");
  const kernel32 = koffi.load("kernel32.dll");

  const HANDLE = koffi.pointer("HANDLE", koffi.opaque());
  koffi.alias("HWND", HANDLE);

  const GetForegroundWindow = user32.func(
    "HWND __stdcall GetForegroundWindow()",
  );
  const GetWindowTextW = user32.func(
    "int __stdcall GetWindowTextW(HWND hWnd, _Out_ uint8_t *lpString, int nMaxCount)",
  );
  const GetWindowThreadProcessId = user32.func(
    "uint32_t __stdcall GetWindowThreadProcessId(HWND hWnd, _Out_ uint32_t *lpdwProcessId)",
  );
  const IsWindow = user32.func("bool __stdcall IsWindow(HWND hWnd)");
  const SetForegroundWindow = user32.func(
    "bool __stdcall SetForegroundWindow(HWND hWnd)",
  );
  const GetAsyncKeyState = user32.func(
    "int16_t __stdcall GetAsyncKeyState(int vKey)",
  );
  const OpenProcess = kernel32.func(
    "HANDLE __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)",
  );
  const QueryFullProcessImageNameW = kernel32.func(
    "bool __stdcall QueryFullProcessImageNameW(HANDLE hProcess, uint32_t dwFlags, _Out_ uint8_t *lpExeName, _Inout_ uint32_t *lpdwSize)",
  );
  const CloseHandle = kernel32.func(
    "bool __stdcall CloseHandle(HANDLE hObject)",
  );

  // SendInput's INPUT struct, from the Win32 example on koffi.dev/composites.
  const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
    dx: "long",
    dy: "long",
    mouseData: "uint32_t",
    dwFlags: "uint32_t",
    time: "uint32_t",
    dwExtraInfo: "uintptr_t",
  });
  const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
    wVk: "uint16_t",
    wScan: "uint16_t",
    dwFlags: "uint32_t",
    time: "uint32_t",
    dwExtraInfo: "uintptr_t",
  });
  const HARDWAREINPUT = koffi.struct("HARDWAREINPUT", {
    uMsg: "uint32_t",
    wParamL: "uint16_t",
    wParamH: "uint16_t",
  });
  const INPUT = koffi.struct("INPUT", {
    type: "uint32_t",
    u: koffi.union({ mi: MOUSEINPUT, ki: KEYBDINPUT, hi: HARDWAREINPUT }),
  });
  const SendInput = user32.func(
    "unsigned int __stdcall SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)",
  );

  const key = (virtualKey: number, up: boolean) => ({
    type: INPUT_KEYBOARD,
    u: {
      ki: {
        wVk: virtualKey,
        wScan: 0,
        dwFlags: up ? KEYEVENTF_KEYUP : 0,
        time: 0,
        dwExtraInfo: 0,
      },
    },
  });

  return {
    getForegroundWindow: () => GetForegroundWindow() as Hwnd | null,

    getWindowTitle(hwnd) {
      const buffer = Buffer.alloc(MAX_CHARS * 2); // UTF-16: 2 bytes per character
      const length = GetWindowTextW(hwnd, buffer, MAX_CHARS) as number;
      return buffer.toString("utf16le", 0, length * 2);
    },

    getWindowProcessId(hwnd) {
      // koffi passes "out" numbers back through a one-item array.
      const pid: (number | null)[] = [null];
      GetWindowThreadProcessId(hwnd, pid);
      return pid[0] ?? 0;
    },

    getProcessExeName(pid) {
      const handle = OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION,
        false,
        pid,
      ) as bigint | null;
      if (!handle) return null; // e.g. a program running as administrator
      try {
        const buffer = Buffer.alloc(MAX_CHARS * 2);
        const size = [MAX_CHARS]; // in: room in characters; out: characters written
        if (!QueryFullProcessImageNameW(handle, 0, buffer, size)) return null;
        const path = buffer.toString("utf16le", 0, size[0] * 2);
        return path.split("\\").pop()?.toLowerCase() ?? null;
      } finally {
        CloseHandle(handle);
      }
    },

    isWindow: (hwnd) => IsWindow(hwnd) as boolean,

    setForegroundWindow: (hwnd) => SetForegroundWindow(hwnd) as boolean,

    // The top bit is set (so the number is negative) while the key is held down.
    isKeyDown: (virtualKey) => (GetAsyncKeyState(virtualKey) as number) < 0,

    sendCtrlV() {
      const events = [
        key(VK_CONTROL, false),
        key(VK_V, false),
        key(VK_V, true),
        key(VK_CONTROL, true),
      ];
      const sent = SendInput(events.length, events, koffi.sizeof(INPUT));
      return sent === events.length;
    },
  };
}
