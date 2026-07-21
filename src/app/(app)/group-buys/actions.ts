"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { parseOrderWorkbook } from "@/lib/orders/parse";

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
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function createGroupBuy(formData: FormData) {
  const title = str(formData.get("title"));
  if (!title) redirect("/group-buys?error=title");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_buys")
    .insert({
      company_id: company.id,
      title,
      status: str(formData.get("status")) ?? "예정",
      start_date: str(formData.get("start_date")),
      end_date: str(formData.get("end_date")),
      settle_days: int(formData.get("settle_days")) ?? 14,
      memo: str(formData.get("memo")),
    })
    .select("id")
    .single();

  if (error || !data) redirect("/group-buys?error=save");
  revalidatePath("/group-buys");
  redirect(`/group-buys/${data.id}`);
}

export async function deleteGroupBuy(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("group_buys").delete().eq("id", id);
  revalidatePath("/group-buys");
  redirect("/group-buys");
}

export async function addItem(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const productId = str(formData.get("product_id"));
  if (!groupBuyId || !productId) redirect(`/group-buys/${groupBuyId}?error=product`);

  const supabase = await createClient();

  // 선택한 제품 이름을 가져와 보관(제품이 나중에 삭제돼도 남도록)
  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("id", productId)
    .maybeSingle<{ name: string }>();

  const { error } = await supabase.from("group_buy_items").insert({
    group_buy_id: groupBuyId,
    product_id: productId,
    product_name: product?.name ?? "제품",
    store_product_no: str(formData.get("store_product_no")),
    allocated_qty: int(formData.get("allocated_qty")),
    gonggu_price: num(formData.get("gonggu_price")),
    margin_unit: num(formData.get("margin_unit")),
  });

  if (error) redirect(`/group-buys/${groupBuyId}?error=save`);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}`);
}

export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("group_buy_items").delete().eq("id", id);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}`);
}

export async function uploadOrders(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const file = formData.get("file");
  if (!groupBuyId) redirect("/group-buys");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/group-buys/${groupBuyId}?uerror=file`);
  }

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();

  // 이 공구의 상품번호 집합
  const { data: items } = await supabase
    .from("group_buy_items")
    .select("store_product_no")
    .eq("group_buy_id", groupBuyId);
  const productNos = new Set(
    (items ?? [])
      .map((i) => String(i.store_product_no ?? "").trim())
      .filter(Boolean),
  );
  if (productNos.size === 0) {
    redirect(`/group-buys/${groupBuyId}?uerror=noitems`);
  }

  // 엑셀 파싱 → 이 공구 상품번호에 해당하는 행만
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseOrderWorkbook(bytes);
  const matched = parsed.filter((o) => productNos.has(o.storeProductNo));

  if (matched.length === 0) {
    redirect(`/group-buys/${groupBuyId}?uerror=nomatch`);
  }

  const rows = matched.map((o) => ({
    company_id: company.id,
    group_buy_id: groupBuyId,
    product_order_no: o.productOrderNo,
    order_no: o.orderNo,
    store_product_no: o.storeProductNo,
    product_name: o.productName,
    option_info: o.optionInfo,
    quantity: o.quantity,
    order_status: o.orderStatus,
    paid_at: o.paidAt,
  }));

  // 멱등: 같은 상품주문번호는 덮어쓰기
  const { error } = await supabase
    .from("orders")
    .upsert(rows, { onConflict: "company_id,product_order_no" });

  if (error) redirect(`/group-buys/${groupBuyId}?uerror=save`);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}?uok=${matched.length}`);
}

/** 정산 시작: settlements 행을 만들고 '검토중' 상태로 둡니다. */
export async function startSettlement(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!groupBuyId) redirect("/group-buys");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  await supabase
    .from("settlements")
    .upsert(
      { company_id: company.id, group_buy_id: groupBuyId, status: "검토중" },
      { onConflict: "group_buy_id" },
    );
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}#settlement`);
}

/** 수수료율 저장 (계산식 편집) */
export async function saveFeeRate(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const rate = num(formData.get("fee_rate"));
  if (!groupBuyId) redirect("/group-buys");

  const supabase = await createClient();
  await supabase
    .from("settlements")
    .update({ fee_rate: rate ?? 0, updated_at: new Date().toISOString() })
    .eq("group_buy_id", groupBuyId);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}#settlement`);
}

/** 공구에 진행 셀러/벤더 연결 */
export async function setGroupBuyContacts(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!groupBuyId) redirect("/group-buys");

  const supabase = await createClient();
  await supabase
    .from("group_buys")
    .update({
      seller_contact_id: str(formData.get("seller_contact_id")),
      vendor_contact_id: str(formData.get("vendor_contact_id")),
    })
    .eq("id", groupBuyId);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}`);
}

/** 공유 링크 생성(없으면 토큰 발급) */
export async function createShareLink(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!groupBuyId) redirect("/group-buys");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("share_links")
    .select("id")
    .eq("group_buy_id", groupBuyId)
    .maybeSingle();

  if (!existing) {
    const token = crypto.randomUUID().replace(/-/g, "");
    await supabase.from("share_links").insert({
      company_id: company.id,
      group_buy_id: groupBuyId,
      token,
      active: true,
    });
  } else {
    await supabase
      .from("share_links")
      .update({ active: true })
      .eq("group_buy_id", groupBuyId);
  }
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}#share`);
}

/** 공유 링크 켜기/끄기 */
export async function toggleShareLink(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!groupBuyId) redirect("/group-buys");

  const supabase = await createClient();
  await supabase
    .from("share_links")
    .update({ active })
    .eq("group_buy_id", groupBuyId);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}#share`);
}

/** 정산 상태 변경: 검토중 → 승인 → 전달 (2단계 승인) */
export async function setSettlementStatus(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!groupBuyId || !["검토중", "승인", "전달"].includes(status)) {
    redirect(`/group-buys/${groupBuyId}#settlement`);
  }

  const supabase = await createClient();
  await supabase
    .from("settlements")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("group_buy_id", groupBuyId);
  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}#settlement`);
}
