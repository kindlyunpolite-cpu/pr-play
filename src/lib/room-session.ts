// Browser-only helpers for storing the current room session
// (player id + session token issued by the server when creating/joining a room).

import type { RoomSession } from "@/types/room";

export type { RoomSession };

const STORAGE_KEY = "prsi.session.v1";

export function loadSession(): RoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export function saveSession(session: RoomSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
