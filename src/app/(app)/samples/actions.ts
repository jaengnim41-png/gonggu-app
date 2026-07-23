"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/** 샘플 발송 기록 */
export async function createSample(formData: FormData) {
  const back = String(formData.get("back") ?? "/samples");
  const contactId = str(formData.get("contact_id"));
  const itemText = str(formData.get("item_text"));

  // 품목 선택값: "p:<제품id>" 또는 "o:<옵션id>:<제품id>" (빈 값이면 직접 입력만 사용)
  const item = String(formData.get("item") ?? "");
  let productId: string | null = null;
  let optionId: string | null = null;
  if (item.startsWith("p:")) {
    productId = item.slice(2) || null;
  } else if (item.startsWith("o:")) {
    const [, oid, pid] = item.split(":");
    optionId = oid || null;
    productId = pid || null;
  }

  if (!contactId && !itemText && !productId) redirect(`${back}?error=input`);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const qtyRaw = String(formData.get("quantity") ?? "").trim();
  const quantity = Math.max(1, parseInt(qtyRaw.replace(/,/g, ""), 10) || 1);

  const supabase = await createClient();
  const { error } = await supabase.from("sample_shipments").insert({
    company_id: company.id,
    contact_id: contactId,
    product_id: productId,
    product_option_id: optionId,
    item_text: itemText,
    quantity,
    sent_at: str(formData.get("sent_at")) ?? new Date().toISOString().slice(0, 10),
    courier: str(formData.get("courier")),
    tracking_no: str(formData.get("tracking_no")),
    memo: str(formData.get("memo")),
  });
  if (error) redirect(`${back}?error=save`);

  revalidatePath(back);
}

/** 회수 여부 토글 (가끔 쓰는 기능) */
export async function toggleReturned(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/samples");
  const next = String(formData.get("returned") ?? "") === "true";
  if (!id) redirect(back);

  const supabase = await createClient();
  await supabase
    .from("sample_shipments")
    .update({ returned: next, returned_at: next ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);

  revalidatePath(back);
}

/** 메모만 빠르게 수정 */
export async function saveSampleMemo(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/samples");
  if (!id) redirect(back);

  const supabase = await createClient();
  await supabase.from("sample_shipments").update({ memo: str(formData.get("memo")) }).eq("id", id);

  revalidatePath(back);
}

/** 샘플 기록 삭제 */
export async function deleteSample(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/samples");
  if (!id) redirect(back);

  const supabase = await createClient();
  await supabase.from("sample_shipments").delete().eq("id", id);

  revalidatePath(back);
}
