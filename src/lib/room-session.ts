// Browser-only helpers for persisted local data.
//
// Two independent slots:
// - room session: identity for an active room (cleared on Leave Room)
// - profile preferences: nickname + avatar (kept across rooms, cleared on Logout)

import type { RoomSession } from "@/types/room";

export type { RoomSession };

export interface RoomProfile {
  nickname: string;
  avatar?: string | null;
}

const SESSION_KEY = "prsi.session.v1";
const PROFILE_KEY = "prsi.profile.v1";

export function loadSession(): RoomSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoomSession;
  } catch {
    return null;
  }
}

export function saveSession(session: RoomSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Mirror identity into the profile slot so the lobby can prefill it later.
  saveProfile({ nickname: session.nickname, avatar: session.avatar ?? null });
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}

export function loadProfile(): RoomProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RoomProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: RoomProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
}
