import { cache } from "react";
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

type ProfileWithCompany = Profile & { companies: Company | Company[] | null };

/**
 * 현재 로그인한 사용자의 프로필과 소속 회사를 불러옵니다.
 * 로그인 안 했으면 user=null, 아직 회사 설정 전이면 company=null.
 *
 * 프로필과 회사를 한 번의 질의로 함께 가져옵니다(왕복 1회).
 * cache()로 감싸 같은 요청 안에서 여러 번 불러도 실제 조회는 1회만 합니다.
 */
export const getSessionProfile = cache(async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, company: null };

  const { data } = await supabase
    .from("profiles")
    .select("id, company_id, name, companies(id, name, role, created_at)")
    .eq("id", user.id)
    .maybeSingle<ProfileWithCompany>();

  if (!data) return { user, profile: null, company: null };

  const { companies, ...profile } = data;
  const company = (Array.isArray(companies) ? companies[0] : companies) ?? null;

  return { user, profile, company };
});
