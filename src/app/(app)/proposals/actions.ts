"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 회사 공통 제안서 정보 저장 */
export async function saveSettings(formData: FormData) {
  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  await supabase.from("proposal_settings").upsert({
    company_id: company.id,
    brand_name: str(formData.get("brand_name")),
    store_url: str(formData.get("store_url")),
    courier: str(formData.get("courier")),
    base_ship_fee: numOrNull(formData.get("base_ship_fee")),
    extra_ship_fee: numOrNull(formData.get("extra_ship_fee")),
    return_fee: numOrNull(formData.get("return_fee")),
    same_day: str(formData.get("same_day")),
    sample_support: str(formData.get("sample_support")),
    cs_note: str(formData.get("cs_note")),
    ship_from: str(formData.get("ship_from")),
    progress_note: str(formData.get("progress_note")),
    settle_note: str(formData.get("settle_note")),
    event_note: str(formData.get("event_note")),
    contact_note: str(formData.get("contact_note")),
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/proposals/settings");
  redirect("/proposals/settings?saved=1");
}

/** 새 제안서 만들기 */
export async function createProposal(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) redirect("/proposals?error=input");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .insert({
      company_id: company.id,
      token: crypto.randomUUID().replace(/-/g, ""),
      title,
      recipient_contact_id: str(formData.get("recipient_contact_id")),
      recipient_name: str(formData.get("recipient_name")),
    })
    .select("id")
    .single();
  if (error || !data) redirect("/proposals?error=save");
  redirect(`/proposals/${data.id}`);
}

/** 제안서에 제품(옵션) 담기 — 현재 가격을 스냅샷으로 */
export async function addProposalItem(formData: FormData) {
  const proposalId = String(formData.get("proposal_id") ?? "");
  if (!proposalId) redirect("/proposals");

  const supabase = await createClient();

  // 제안서의 기본 수수료율
  const { data: prop } = await supabase
    .from("proposals")
    .select("fee_rate_default")
    .eq("id", proposalId)
    .maybeSingle();
  const feeDefault = prop?.fee_rate_default ?? 0.25;

  // "o:<옵션id>:<제품id>" 또는 "p:<제품id>" 또는 빈값(직접입력)
  const item = String(formData.get("item") ?? "");
  let productId: string | null = null;
  let optionId: string | null = null;
  let name = str(formData.get("name_text"));
  let optionLabel = str(formData.get("option_text"));
  let normalPrice = numOrNull(formData.get("normal_price"));
  let gongguPrice = numOrNull(formData.get("gonggu_price"));
  let detailUrl: string | null = null;

  if (item.startsWith("o:") || item.startsWith("p:")) {
    if (item.startsWith("o:")) {
      const [, oid, pid] = item.split(":");
      optionId = oid || null;
      productId = pid || null;
    } else {
      productId = item.slice(2) || null;
    }
    // 제품/옵션에서 이름·가격 스냅샷
    if (productId) {
      const { data: p } = await supabase
        .from("products")
        .select("name, detail_url, normal_price")
        .eq("id", productId)
        .maybeSingle();
      if (p) {
        name = name ?? p.name;
        detailUrl = p.detail_url;
        normalPrice = normalPrice ?? p.normal_price;
      }
    }
    if (optionId) {
      const { data: o } = await supabase
        .from("product_options")
        .select("name, normal_price, gonggu_price")
        .eq("id", optionId)
        .maybeSingle();
      if (o) {
        optionLabel = optionLabel ?? o.name;
        normalPrice = normalPrice ?? o.normal_price;
        gongguPrice = gongguPrice ?? o.gonggu_price;
      }
    }
  }

  if (!name && !optionLabel) redirect(`/proposals/${proposalId}?error=item`);

  // 정렬 순서 = 맨 뒤
  const { count } = await supabase
    .from("proposal_items")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);

  const feeRate = numOrNull(formData.get("fee_rate"));
  await supabase.from("proposal_items").insert({
    proposal_id: proposalId,
    product_id: productId,
    product_option_id: optionId,
    name: name ?? optionLabel ?? "상품",
    option_label: optionLabel,
    detail_url: detailUrl,
    normal_price: normalPrice,
    gonggu_price: gongguPrice,
    fee_rate: feeRate ?? feeDefault,
    sort_order: count ?? 0,
  });

  revalidatePath(`/proposals/${proposalId}`);
}

/** 제안서 품목 열람 on/off */
export async function toggleItemVisible(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const proposalId = String(formData.get("proposal_id") ?? "");
  const next = String(formData.get("visible") ?? "") === "true";
  if (!id) redirect(`/proposals/${proposalId}`);

  const supabase = await createClient();
  await supabase.from("proposal_items").update({ visible: next }).eq("id", id);
  revalidatePath(`/proposals/${proposalId}`);
}

/** 제안서 품목 삭제 */
export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const proposalId = String(formData.get("proposal_id") ?? "");
  const supabase = await createClient();
  await supabase.from("proposal_items").delete().eq("id", id);
  revalidatePath(`/proposals/${proposalId}`);
}

/** 공유 링크 on/off */
export async function toggleProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("proposals").update({ active: next }).eq("id", id);
  revalidatePath(`/proposals/${id}`);
}

/** 제안서 삭제 */
export async function deleteProposal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("proposals").delete().eq("id", id);
  revalidatePath("/proposals");
  redirect("/proposals");
}
