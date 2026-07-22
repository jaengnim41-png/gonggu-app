"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";

/** 로그인 사용자의 표시 이름 */
export async function myDisplayName(): Promise<string> {
  const { user, profile } = await getSessionProfile();
  return profile?.name?.trim() || user?.email?.split("@")[0] || "우리";
}

/** 메시지 보내기 (우리 회사 쪽) */
export async function sendMessage(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!threadId || !body) redirect(`/messages?t=${threadId}`);

  const { user, company } = await getSessionProfile();
  if (!user || !company) redirect("/");

  const supabase = await createClient();
  await supabase.from("messages").insert({
    company_id: company.id,
    thread_id: threadId,
    author_side: "회사",
    author_user_id: user.id,
    author_name: await myDisplayName(),
    body,
  });
  await supabase
    .from("thread_reads")
    .upsert({ thread_id: threadId, user_id: user.id, last_read_at: new Date().toISOString() });

  revalidatePath("/messages");
  redirect(`/messages?t=${threadId}`);
}

/** 공구/거래처 화면에서 "메시지" 버튼 → 방을 만들고(있으면 재사용) 이동 */
export async function openThread(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const groupBuyId = String(formData.get("group_buy_id") ?? "") || null;
  const contactId = String(formData.get("contact_id") ?? "") || null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_thread", {
    p_kind: kind,
    p_group_buy_id: groupBuyId,
    p_contact_id: contactId,
  });
  if (error || !data) redirect("/messages?error=open");
  redirect(`/messages?t=${data}`);
}

/** 방을 읽음 처리 */
export async function markThreadRead(threadId: string) {
  const { user } = await getSessionProfile();
  if (!user || !threadId) return;
  const supabase = await createClient();
  await supabase
    .from("thread_reads")
    .upsert({ thread_id: threadId, user_id: user.id, last_read_at: new Date().toISOString() });
}
