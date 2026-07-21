import { createClient } from "@supabase/supabase-js";

/**
 * 로그인 세션이 필요 없는 공개용 클라이언트.
 * 비로그인 공유 페이지에서 shared_group_buy() 같은 공개 함수를 호출할 때 사용합니다.
 */
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
