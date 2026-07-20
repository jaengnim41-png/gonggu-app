import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  name: string;
  role: string;
  created_at: string;
};

export type Profile = {
  id: string;
  company_id: string | null;
  name: string | null;
};

export type SessionProfile = {
  user: User | null;
  profile: Profile | null;
  company: Company | null;
};

/**
 * 현재 로그인한 사용자의 프로필과 소속 회사를 불러옵니다.
 * 로그인 안 했으면 user=null, 아직 회사 설정 전이면 company=null.
 */
export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, company: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, name")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  let company: Company | null = null;
  if (profile?.company_id) {
    const { data } = await supabase
      .from("companies")
      .select("id, name, role, created_at")
      .eq("id", profile.company_id)
      .maybeSingle<Company>();
    company = data ?? null;
  }

  return { user, profile: profile ?? null, company };
}
