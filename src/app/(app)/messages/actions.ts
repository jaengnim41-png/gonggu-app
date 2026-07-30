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

  // 같은 화면에 머무르므로 redirect 없이 갱신만 합니다(서버 왕복 1회 절약).
  revalidatePath("/messages");
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

/** 거래처를 골라 새 대화 시작(있으면 기존 방으로) */
export async function startThread(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) redirect("/messages");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_thread", {
    p_kind: "거래처",
    p_group_buy_id: null,
    p_contact_id: contactId,
  });
  if (error || !data) redirect("/messages?error=open");
  redirect(`/messages?t=${data}`);
}

/** 대화방 삭제 (방 + 메시지 함께) */
export async function deleteThread(formData: FormData) {
  const threadId = String(formData.get("thread_id") ?? "");
  if (!threadId) redirect("/messages");

  const { company } = await getSessionProfile();
  if (!company) redirect("/");

  const supabase = await createClient();
  // 내 회사 방인지 확인 후 삭제 (메시지는 on delete cascade)
  await supabase.from("message_threads").delete().eq("id", threadId).eq("company_id", company.id);

  revalidatePath("/messages");
  redirect("/messages");
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
