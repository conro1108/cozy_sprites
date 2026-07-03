// Local notification preferences + dispatch. Three levels, user-toggled:
//   off  — never notify
//   dire — only emergencies (illness, near-death, death)
//   all  — any care drop (hunger, mess, attention calls) too
// Notifications only fire while the tab is hidden — if you're looking at the
// pet, the pet can tell you itself.

export type NotifyPref = "off" | "dire" | "all";
export type NotifyKind = "dire" | "care";

const PREF_KEY = "cozy-sprites-notify";

export function getNotifyPref(): NotifyPref {
  const v = localStorage.getItem(PREF_KEY);
  return v === "dire" || v === "all" ? v : "off";
}

/**
 * Set the preference, requesting browser permission when turning it on.
 * Returns the pref that actually took effect (permission denied → "off").
 */
export async function setNotifyPref(pref: NotifyPref): Promise<NotifyPref> {
  if (pref === "off") {
    localStorage.setItem(PREF_KEY, "off");
    return "off";
  }
  if (!("Notification" in window)) return getNotifyPref();
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  const effective: NotifyPref = permission === "granted" ? pref : "off";
  localStorage.setItem(PREF_KEY, effective);
  return effective;
}

/** Fire a notification if the pref level allows it and the tab is hidden. */
export function notify(kind: NotifyKind, title: string, body: string): void {
  const pref = getNotifyPref();
  if (pref === "off") return;
  if (pref === "dire" && kind !== "dire") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return;
  try {
    // Prefer the service worker (survives better on mobile PWA installs).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && "showNotification" in reg) {
          reg.showNotification(title, { body, icon: "/icon-192.png" });
        } else {
          new Notification(title, { body });
        }
      });
    } else {
      new Notification(title, { body });
    }
  } catch {
    // Notifications are best-effort; never let them break the game.
  }
}
