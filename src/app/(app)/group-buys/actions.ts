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
      status: str(formData.get("status")) ?? "①제안접수",
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

  // 선택한 제품 이름·상세URL을 가져와 보관(제품이 나중에 삭제돼도 남도록)
  const { data: product } = await supabase
    .from("products")
    .select("name, detail_url")
    .eq("id", productId)
    .maybeSingle<{ name: string; detail_url: string | null }>();

  // 입력값이 비어 있으면 카탈로그 옵션에서 자동으로 채운다
  let gonggu = num(formData.get("gonggu_price"));
  let margin = num(formData.get("margin_unit"));
  if (gonggu == null) {
    const { data: opt } = await supabase
      .from("product_options")
      .select("gonggu_price, supply_price")
      .eq("product_id", productId)
      .not("gonggu_price", "is", null)
      .order("sort_order")
      .limit(1)
      .maybeSingle<{ gonggu_price: number | null; supply_price: number | null }>();
    if (opt?.gonggu_price != null) {
      gonggu = opt.gonggu_price;
      // 마진 = 공구가 − 공급가 (공급가가 있으면)
      if (margin == null && opt.supply_price != null) {
        margin = opt.gonggu_price - opt.supply_price;
      }
    }
  }

  // 상품번호가 비었으면 제품 상세URL에서 추출 시도 (…/products/13641036877)
  let storeNo = str(formData.get("store_product_no"));
  if (!storeNo && product?.detail_url) {
    const m = product.detail_url.match(/\/products\/(\d+)/);
    if (m) storeNo = m[1];
  }

  const { error } = await supabase.from("group_buy_items").insert({
    group_buy_id: groupBuyId,
    product_id: productId,
    product_name: product?.name ?? "제품",
    store_product_no: storeNo,
    allocated_qty: int(formData.get("allocated_qty")),
    gonggu_price: gonggu,
    margin_unit: margin,
  });

  if (error) redirect(`/group-buys/${groupBuyId}?error=save`);
  revalidatePath(`/group-buys/${groupBuyId}`);
}

export async function deleteItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("group_buy_items").delete().eq("id", id);
  revalidatePath(`/group-buys/${groupBuyId}`);
}

/**
 * 공구상품의 판매 수량을 직접 입력합니다.
 * 값을 비우면 다시 주문 업로드 기준 자동 계산으로 돌아갑니다.
 */
export async function saveManualSold(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!id) return;

  const raw = String(formData.get("manual_sold_qty") ?? "").trim().replace(/,/g, "");
  const manual = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);

  const supabase = await createClient();
  await supabase.from("group_buy_items").update({ manual_sold_qty: manual }).eq("id", id);
  revalidatePath(`/group-buys/${groupBuyId}`);
}

/**
 * 공구상품 한 줄 수정 — 상품번호·배정·공구가·마진·판매수량.
 * 판매수량을 비우면 다시 주문 업로드 기준 자동 계산으로 돌아갑니다.
 */
export async function updateItem(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!id) return;

  const numOrNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim().replace(/,/g, "");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const strOrNull = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim();
    return s ? s : null;
  };

  const soldRaw = numOrNull(formData.get("manual_sold_qty"));

  const supabase = await createClient();
  await supabase
    .from("group_buy_items")
    .update({
      store_product_no: strOrNull(formData.get("store_product_no")),
      allocated_qty: numOrNull(formData.get("allocated_qty")),
      gonggu_price: numOrNull(formData.get("gonggu_price")),
      margin_unit: numOrNull(formData.get("margin_unit")),
      manual_sold_qty: soldRaw == null ? null : Math.max(0, Math.round(soldRaw)),
    })
    .eq("id", id);

  revalidatePath(`/group-buys/${groupBuyId}`);
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
}

/** 옵션별 가격 예외 저장(있으면 갱신). 한 상품 안에서 옵션마다 가격이 다를 때. */
export async function setOptionPrice(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const itemId = String(formData.get("group_buy_item_id") ?? "");
  const optionInfo = String(formData.get("option_info") ?? "").trim();
  if (!groupBuyId || !itemId || !optionInfo) redirect(`/group-buys/${groupBuyId}`);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const n = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim().replace(/,/g, "");
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  };

  const supabase = await createClient();
  await supabase.from("group_buy_item_prices").upsert(
    {
      company_id: company.id,
      group_buy_item_id: itemId,
      option_info: optionInfo,
      gonggu_price: n(formData.get("gonggu_price")),
      margin_unit: n(formData.get("margin_unit")),
    },
    { onConflict: "group_buy_item_id,option_info" }
  );

  revalidatePath(`/group-buys/${groupBuyId}`);
}

/**
 * 여러 옵션의 단가를 한 번에 지정합니다.
 * targets 각 값은 JSON `[공구상품id, 옵션글자]` 형식.
 * 공구가·마진을 모두 비우면 선택한 옵션들의 개별단가를 해제합니다.
 */
export async function setOptionPricesBulk(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!groupBuyId) redirect("/group-buys");

  const targets = formData.getAll("target").map(String).filter(Boolean);
  if (targets.length === 0) redirect(`/group-buys/${groupBuyId}?bulk=none`);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const n = (v: FormDataEntryValue | null) => {
    const s = String(v ?? "").trim().replace(/,/g, "");
    if (!s) return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  };
  const gonggu = n(formData.get("gonggu_price"));
  const margin = n(formData.get("margin_unit"));

  const parsed: { itemId: string; optionInfo: string }[] = [];
  for (const t of targets) {
    try {
      const [itemId, optionInfo] = JSON.parse(t) as [string, string];
      if (itemId && optionInfo) parsed.push({ itemId, optionInfo });
    } catch {
      // 형식이 깨진 값은 건너뜁니다
    }
  }
  if (parsed.length === 0) redirect(`/group-buys/${groupBuyId}?bulk=none`);

  const supabase = await createClient();

  // 둘 다 비우면 개별단가 해제
  if (gonggu == null && margin == null) {
    for (const p of parsed) {
      await supabase
        .from("group_buy_item_prices")
        .delete()
        .eq("group_buy_item_id", p.itemId)
        .eq("option_info", p.optionInfo);
    }
  } else {
    await supabase.from("group_buy_item_prices").upsert(
      parsed.map((p) => ({
        company_id: company.id,
        group_buy_item_id: p.itemId,
        option_info: p.optionInfo,
        gonggu_price: gonggu,
        margin_unit: margin,
      })),
      { onConflict: "group_buy_item_id,option_info" }
    );
  }

  revalidatePath(`/group-buys/${groupBuyId}`);
  redirect(`/group-buys/${groupBuyId}?bulk=${parsed.length}`);
}

/** 옵션별 가격 예외 삭제 → 상품 기본가로 되돌림 */
export async function deleteOptionPrice(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(`/group-buys/${groupBuyId}`);

  const supabase = await createClient();
  await supabase.from("group_buy_item_prices").delete().eq("id", id);
  revalidatePath(`/group-buys/${groupBuyId}`);
}

/** 공구에 셀러·벤더 여러 곳 연결(체크박스 전체 재설정) */
export async function setGroupBuyContactsMulti(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  if (!groupBuyId) redirect("/group-buys");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const sellerIds = formData.getAll("seller_ids").map(String).filter(Boolean);
  const vendorIds = formData.getAll("vendor_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  await supabase.from("group_buy_contacts").delete().eq("group_buy_id", groupBuyId);

  const rows = [
    ...sellerIds.map((cid) => ({ company_id: company.id, group_buy_id: groupBuyId, contact_id: cid, role: "셀러" })),
    ...vendorIds.map((cid) => ({ company_id: company.id, group_buy_id: groupBuyId, contact_id: cid, role: "벤더" })),
  ];
  if (rows.length) await supabase.from("group_buy_contacts").insert(rows);

  // 실적 집계(셀러/벤더 상세)는 아직 단일 컬럼을 쓰므로 대표 1곳을 함께 저장
  await supabase
    .from("group_buys")
    .update({
      seller_contact_id: sellerIds[0] ?? null,
      vendor_contact_id: vendorIds[0] ?? null,
    })
    .eq("id", groupBuyId);

  revalidatePath(`/group-buys/${groupBuyId}`);
}

/** 공구 상태 변경 (12단계) */
export async function setGroupBuyStatus(formData: FormData) {
  const groupBuyId = String(formData.get("group_buy_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!groupBuyId || !status) redirect("/group-buys");

  const supabase = await createClient();
  await supabase.from("group_buys").update({ status }).eq("id", groupBuyId);
  revalidatePath(`/group-buys/${groupBuyId}`);
  revalidatePath("/group-buys");
}
