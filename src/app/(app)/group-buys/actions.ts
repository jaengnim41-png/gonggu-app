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
