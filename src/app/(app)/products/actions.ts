"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { parseProductWorkbook } from "@/lib/products/parse";
import { isLive } from "@/lib/orders/parse";

/** 폼 값에서 숫자를 뽑되, 비어 있으면 null */
function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

export async function createProduct(formData: FormData) {
  const name = str(formData.get("name"));
  if (!name) redirect("/products?error=name");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();

  // 새 제품은 맨 뒤 순서로
  const { data: last } = await supabase
    .from("products")
    .select("sort_order")
    .eq("company_id", company.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("products").insert({
    company_id: company.id,
    name,
    category: str(formData.get("category")),
    detail_url: str(formData.get("detail_url")),
    normal_price: num(formData.get("normal_price")),
    supply_price: num(formData.get("supply_price")),
    selling_point: str(formData.get("selling_point")),
    caution: str(formData.get("caution")),
    sort_order: nextOrder,
  });

  if (error) redirect("/products?error=save");
  revalidatePath("/products");
  redirect("/products");
}

/** 제품 정보 수정 */
export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = str(formData.get("name"));
  if (!id) redirect("/products");
  if (!name) redirect("/products?error=name");

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name,
      category: str(formData.get("category")),
      detail_url: str(formData.get("detail_url")),
      normal_price: num(formData.get("normal_price")),
      supply_price: num(formData.get("supply_price")),
      selling_point: str(formData.get("selling_point")),
      caution: str(formData.get("caution")),
    })
    .eq("id", id);

  if (error) redirect("/products?error=save");
  revalidatePath("/products");
  redirect("/products");
}

/** 제품 순서 한 칸 이동 (dir: up | down) — 옆 제품과 sort_order 교환 */
export async function moveProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dir = String(formData.get("dir") ?? "");
  if (!id || (dir !== "up" && dir !== "down")) redirect("/products");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("products")
    .select("id, sort_order")
    .eq("company_id", company.id)
    .order("sort_order", { ascending: true });
  if (!list) redirect("/products");

  const idx = list.findIndex((p) => p.id === id);
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) redirect("/products");

  const a = list[idx];
  const b = list[swapIdx];
  // 두 제품의 순서값을 맞바꿈
  await supabase.from("products").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("products").update({ sort_order: a.sort_order }).eq("id", b.id);

  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/products");
  redirect("/products");
}

export async function addOption(formData: FormData) {
  const productId = String(formData.get("product_id") ?? "");
  const name = str(formData.get("name"));
  if (!productId || !name) redirect(`/products/${productId}?error=name`);

  const supabase = await createClient();
  const { error } = await supabase.from("product_options").insert({
    product_id: productId,
    name,
    option_key: str(formData.get("option_key")),
    normal_price: num(formData.get("normal_price")),
    gonggu_price: num(formData.get("gonggu_price")),
    supply_price: num(formData.get("supply_price")),
  });

  if (error) redirect(`/products/${productId}?error=save`);
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

export async function deleteOption(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const productId = String(formData.get("product_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("product_options").delete().eq("id", id);
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

/**
 * 엑셀 일괄 등록.
 * 한 행 = 옵션 하나. 제품명(대분류)이 같으면 한 제품으로 묶입니다.
 * 이미 있는 제품/옵션은 이름으로 찾아 값을 갱신하고, 없으면 새로 만듭니다(멱등).
 */
export async function bulkUploadProducts(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/products?uerror=file");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const bytes = new Uint8Array(await (file as File).arrayBuffer());
  const parsed = parseProductWorkbook(bytes);
  if (parsed.length === 0) redirect("/products?uerror=empty");

  const supabase = await createClient();

  // 재고 계산용: 옵션별 현재 가용 (입고합 − 판매합)
  const [{ data: allIns }, { data: allInvOrders }] = await Promise.all([
    supabase.from("stock_ins").select("product_option_id, quantity"),
    supabase.from("inventory_orders").select("product_option_id, quantity, order_status"),
  ]);
  const availByOpt = new Map<string, number>();
  for (const r of allIns ?? []) {
    availByOpt.set(r.product_option_id, (availByOpt.get(r.product_option_id) ?? 0) + (r.quantity ?? 0));
  }
  for (const o of allInvOrders ?? []) {
    if (!o.product_option_id || !isLive(o.order_status)) continue;
    availByOpt.set(o.product_option_id, (availByOpt.get(o.product_option_id) ?? 0) - (o.quantity ?? 0));
  }
  // 엑셀의 '현재재고'를 반영할 조정 기록 모음
  const stockAdjust: { product_option_id: string; target: number }[] = [];

  // 현재 제품/옵션 조회(이름 기준 매칭)
  const { data: existP } = await supabase
    .from("products")
    .select("id, name, sort_order")
    .eq("company_id", company.id);
  const prodByName = new Map((existP ?? []).map((p) => [p.name, p]));
  let maxOrder = Math.max(-1, ...(existP ?? []).map((p) => p.sort_order ?? 0));

  // 엑셀 등장 순서대로 제품 그룹화
  const order: string[] = [];
  const groups = new Map<string, typeof parsed>();
  for (const row of parsed) {
    if (!groups.has(row.productName)) {
      groups.set(row.productName, []);
      order.push(row.productName);
    }
    groups.get(row.productName)!.push(row);
  }

  let newProducts = 0;
  let optionsUpserted = 0;

  for (const name of order) {
    const rows = groups.get(name)!;
    const head = rows[0];
    let productId = prodByName.get(name)?.id;

    if (!productId) {
      maxOrder += 1;
      const { data: created, error } = await supabase
        .from("products")
        .insert({
          company_id: company.id,
          name,
          category: head.category,
          detail_url: head.detailUrl,
          normal_price: head.normalPrice,
          sort_order: maxOrder,
        })
        .select("id")
        .single();
      if (error || !created) continue;
      productId = created.id;
      newProducts += 1;
    } else {
      // 제품 메타는 값이 있을 때만 덮어씀
      const patch: Record<string, unknown> = {};
      if (head.category) patch.category = head.category;
      if (head.detailUrl) patch.detail_url = head.detailUrl;
      if (head.normalPrice != null) patch.normal_price = head.normalPrice;
      if (Object.keys(patch).length) await supabase.from("products").update(patch).eq("id", productId);
    }

    // 이 제품의 기존 옵션
    const { data: existO } = await supabase
      .from("product_options")
      .select("id, name, sort_order")
      .eq("product_id", productId);
    const optByName = new Map((existO ?? []).map((o) => [o.name, o]));
    let optOrder = Math.max(-1, ...(existO ?? []).map((o) => o.sort_order ?? 0));

    for (const row of rows) {
      if (!row.optionName) continue;
      const existing = optByName.get(row.optionName);
      let optionId: string | null = null;
      if (existing) {
        optionId = existing.id;
        // 값이 있는 칸만 갱신 — 빈 칸이 기존 가격을 지우지 않도록
        const patch: Record<string, unknown> = {};
        if (row.sku) patch.option_key = row.sku;
        if (row.normalPrice != null) patch.normal_price = row.normalPrice;
        if (row.gongguPrice != null) patch.gonggu_price = row.gongguPrice;
        if (row.supplyPrice != null) patch.supply_price = row.supplyPrice;
        if (Object.keys(patch).length) {
          await supabase.from("product_options").update(patch).eq("id", existing.id);
        }
      } else {
        optOrder += 1;
        const { data: createdOpt } = await supabase
          .from("product_options")
          .insert({
            product_id: productId,
            name: row.optionName,
            option_key: row.sku,
            normal_price: row.normalPrice,
            gonggu_price: row.gongguPrice,
            supply_price: row.supplyPrice,
            sort_order: optOrder,
          })
          .select("id")
          .single();
        optionId = createdOpt?.id ?? null;
      }
      optionsUpserted += 1;
      // '현재재고' 칸이 채워져 있으면 그 숫자가 가용이 되도록 예약
      if (optionId && row.stock != null) {
        stockAdjust.push({ product_option_id: optionId, target: row.stock });
      }
    }
  }

  // 현재재고 반영: 목표값 − 현재 가용 만큼 조정 기록 추가
  const adjustRows = stockAdjust
    .map((a) => ({
      company_id: company.id,
      product_option_id: a.product_option_id,
      quantity: a.target - (availByOpt.get(a.product_option_id) ?? 0),
      note: "엑셀 일괄 재고 설정",
    }))
    .filter((r) => r.quantity !== 0);
  if (adjustRows.length) {
    await supabase.from("stock_ins").insert(adjustRows);
  }

  revalidatePath("/products");
  redirect(`/products?uok=${newProducts}-${optionsUpserted}-${stockAdjust.length}`);
}
