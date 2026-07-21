"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { parseOrderWorkbook } from "@/lib/orders/parse";

function keyOf(pno: string | null, opt: string | null) {
  return `${(pno ?? "").trim()}|${(opt ?? "").trim()}`;
}

/** 입고 등록 */
export async function addStockIn(formData: FormData) {
  const optionId = String(formData.get("product_option_id") ?? "");
  const qty = parseInt(String(formData.get("quantity") ?? "").replace(/,/g, ""), 10);
  if (!optionId || !Number.isFinite(qty)) redirect("/inventory?error=input");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase.from("stock_ins").insert({
    company_id: company.id,
    product_option_id: optionId,
    quantity: qty,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) redirect("/inventory?error=save");
  revalidatePath("/inventory");
  redirect("/inventory");
}

/** 전체 주문 파일 업로드 → 재고 차감(멱등). 아는 옵션은 자동 매칭. */
export async function uploadInventoryOrders(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/inventory?uerror=file");
  }

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");
  const supabase = await createClient();

  // 이미 이어둔 옵션 연결 불러오기
  const { data: matches } = await supabase
    .from("option_matches")
    .select("store_product_no, option_info, product_option_id");
  const matchMap = new Map<string, string>();
  for (const m of matches ?? []) {
    matchMap.set(keyOf(m.store_product_no, m.option_info), m.product_option_id);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = parseOrderWorkbook(bytes);
  if (parsed.length === 0) redirect("/inventory?uerror=empty");

  const rows = parsed.map((o) => ({
    company_id: company.id,
    product_order_no: o.productOrderNo,
    order_no: o.orderNo,
    store_product_no: o.storeProductNo,
    option_info: o.optionInfo,
    quantity: o.quantity,
    order_status: o.orderStatus,
    product_option_id: matchMap.get(keyOf(o.storeProductNo, o.optionInfo)) ?? null,
  }));

  const { error } = await supabase
    .from("inventory_orders")
    .upsert(rows, { onConflict: "company_id,product_order_no" });
  if (error) redirect("/inventory?uerror=save");

  revalidatePath("/inventory");
  redirect(`/inventory?uok=${rows.length}`);
}

/** 옵션 연결 도우미: 주문 옵션글자 ↔ 제품옵션 연결(기억) + 기존 주문에 소급 적용 */
export async function linkOption(formData: FormData) {
  const storeNo = String(formData.get("store_product_no") ?? "").trim();
  const optionInfo = String(formData.get("option_info") ?? "").trim();
  const optionId = String(formData.get("product_option_id") ?? "");
  if (!optionId) redirect("/inventory?error=input");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");
  const supabase = await createClient();

  // 연결 기억
  await supabase.from("option_matches").upsert(
    {
      company_id: company.id,
      store_product_no: storeNo,
      option_info: optionInfo,
      product_option_id: optionId,
    },
    { onConflict: "company_id,store_product_no,option_info" },
  );

  // 이미 올라온 같은 옵션글자의 주문들에 소급 적용
  await supabase
    .from("inventory_orders")
    .update({ product_option_id: optionId })
    .eq("company_id", company.id)
    .eq("store_product_no", storeNo)
    .eq("option_info", optionInfo);

  revalidatePath("/inventory");
  redirect("/inventory");
}
