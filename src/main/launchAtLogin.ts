import { app } from "electron";

// Added to the command line when Windows starts Picasso at login, so it can start hidden.
const LAUNCHED_AT_LOGIN_ARG = "--launched-at-login";

/** Only the installed app can launch at login. In dev, Windows would start a bare Electron instead. */
export const canLaunchAtLogin = app.isPackaged;

export function isLaunchAtLoginEnabled(): boolean {
  // Windows finds the login entry by exe path + args, so look it up with the same args we register.
  return app.getLoginItemSettings({ args: [LAUNCHED_AT_LOGIN_ARG] }).openAtLogin;
}

export function setLaunchAtLogin(enabled: boolean): void {
  if (!canLaunchAtLogin) return;
  app.setLoginItemSettings({ openAtLogin: enabled, args: [LAUNCHED_AT_LOGIN_ARG] });
}

export function wasLaunchedAtLogin(): boolean {
  return process.argv.includes(LAUNCHED_AT_LOGIN_ARG);
}
