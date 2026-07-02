import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NickSchema = z.string().trim().min(2).max(24);
const PasswordSchema = z.string().min(6).max(128);
const RecoveryEmailSchema = z.string().trim().email().optional().or(z.literal(""));
const ProviderSchema = z.enum(["google"]);

export function toLoginSlug(nick: string) {
  return nick.trim().toLocaleLowerCase("cs-CZ");
}

function makeInternalEmail(slug: string) {
  const safeSlug = slug
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "player";
  return `${safeSlug}.${crypto.randomUUID()}@accounts.prsi.local`;
}

function friendlyDuplicate(error: unknown) {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.toLowerCase().includes("duplicate") || message.includes("23505")) {
    throw new Error("Tenhle nick už je zabraný. Zkus jiný.");
  }
}

async function currentAuthUserId(accessToken?: string | null) {
  if (!accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error) return null;
  return data.user?.id ?? null;
}

export async function getCurrentProfileForAccessToken(accessToken?: string | null) {
  const userId = await currentAuthUserId(accessToken);
  if (!userId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, nick, login_slug")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getCurrentProfileId(accessToken?: string | null) {
  const profile = await getCurrentProfileForAccessToken(accessToken);
  return profile?.id ?? null;
}

export const createQuickAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ nick: NickSchema, password: PasswordSchema, recoveryEmail: RecoveryEmailSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const nick = data.nick.trim();
    const loginSlug = toLoginSlug(nick);
    const recoveryEmail = data.recoveryEmail?.trim() || null;
    const internalEmail = makeInternalEmail(loginSlug);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { nick, login_slug: loginSlug, recovery_email: recoveryEmail },
    });
    if (authError || !authData.user) throw new Error("Účet se nepodařilo vytvořit.");

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authData.user.id,
      nick,
      login_slug: loginSlug,
      internal_auth_email: internalEmail,
      recovery_email: recoveryEmail,
      auth_provider: "quick",
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      friendlyDuplicate(profileError);
      throw new Error("Účet se nepodařilo vytvořit.");
    }

    return { authEmail: internalEmail, profile: { id: authData.user.id, nick, avatar_url: null } };
  });

export const resolveNickLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ nick: NickSchema }).parse(input))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("internal_auth_email")
      .eq("login_slug", toLoginSlug(data.nick))
      .maybeSingle();
    if (error || !profile?.internal_auth_email) throw new Error("Nick nebo heslo nesedí.");
    return { authEmail: profile.internal_auth_email };
  });

export const getMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ accessToken: z.string().optional().nullable() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const userId = await currentAuthUserId(data.accessToken);
    if (!userId) return null;
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nick, avatar_url, auth_provider")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error("Profil se nepodařilo načíst.");
    return profile;
  });

export const reserveSocialNick = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ accessToken: z.string().optional().nullable(), nick: NickSchema, provider: ProviderSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await currentAuthUserId(data.accessToken);
    if (!userId) throw new Error("Nejdřív se přihlas přes Google.");
    const nick = data.nick.trim();
    const { error } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      nick,
      login_slug: toLoginSlug(nick),
      auth_provider: data.provider,
    });
    if (error) {
      friendlyDuplicate(error);
      throw new Error("Nick se nepodařilo zabrat.");
    }
    return { id: userId, nick, avatar_url: null };
  });
