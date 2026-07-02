import { supabase } from "@/integrations/supabase/client";

export async function getSupabaseAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
