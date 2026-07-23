"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function int(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** 셀러/벤더 등록 */
export async function createContact(formData: FormData) {
  const kind = String(formData.get("kind") ?? "");
  const path = kind === "벤더" ? "/vendors" : "/sellers";
  const name = str(formData.get("name"));
  if (!name || !["셀러", "벤더"].includes(kind)) redirect(`${path}?error=input`);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").insert({
    company_id: company.id,
    kind,
    name,
    instagram: str(formData.get("instagram")),
    followers: int(formData.get("followers")),
    contact_info: str(formData.get("contact_info")),
    linked_vendor_id: str(formData.get("linked_vendor_id")),
    memo: str(formData.get("memo")),
  });
  if (error) redirect(`${path}?error=save`);
  revalidatePath(path);
  redirect(path);
}

/** 거래처 초대 링크 만들기(없으면) — 링크만으로는 열람 불가, 승인해야 열린다 */
export async function createGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) redirect("/sellers");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("guest_links")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("guest_links").insert({
      company_id: company.id,
      contact_id: contactId,
      token: crypto.randomUUID().replace(/-/g, ""),
      active: true,
    });
  }
  revalidatePath(`/contacts/${contactId}`);
}

/** 초대 링크 켜기/끄기 */
export async function toggleGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("guest_links").update({ active: next }).eq("contact_id", contactId);
  revalidatePath(`/contacts/${contactId}`);
}

/** 초대 링크 재발급 — 기존 링크는 즉시 무효가 된다 */
export async function regenerateGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("guest_links")
    .update({ token: crypto.randomUUID().replace(/-/g, ""), active: true })
    .eq("contact_id", contactId);
  revalidatePath(`/contacts/${contactId}`);
}

/** 게스트 승인 / 차단 / 대기로 되돌리기 */
export async function setGuestStatus(formData: FormData) {
  const guestId = String(formData.get("guest_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = String(formData.get("back") ?? "");
  if (!guestId || !["대기", "승인", "차단"].includes(status)) redirect(back || "/guests");

  const supabase = await createClient();
  await supabase
    .from("guests")
    .update({ status, approved_at: status === "승인" ? new Date().toISOString() : null })
    .eq("id", guestId);

  revalidatePath(back || "/guests");
}

/** 셀러/벤더 정보 수정 */
export async function updateContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const detail = `/contacts/${id}`;
  if (!id) redirect(kind === "벤더" ? "/vendors" : "/sellers");

  const name = str(formData.get("name"));
  if (!name) redirect(`${detail}?error=input`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      instagram: str(formData.get("instagram")),
      followers: int(formData.get("followers")),
      contact_info: str(formData.get("contact_info")),
      linked_vendor_id: str(formData.get("linked_vendor_id")),
      memo: str(formData.get("memo")),
    })
    .eq("id", id);
  if (error) redirect(`${detail}?error=save`);

  revalidatePath(detail);
  revalidatePath(kind === "벤더" ? "/vendors" : "/sellers");
  redirect(`${detail}?saved=1`);
}

/** 셀러/벤더 삭제 */
export async function deleteContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const path = kind === "벤더" ? "/vendors" : "/sellers";
  if (!id) redirect(path);

  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath(path);
  redirect(path);
}
