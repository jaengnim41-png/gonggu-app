"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";

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
  const { error } = await supabase.from("products").insert({
    company_id: company.id,
    name,
    category: str(formData.get("category")),
    detail_url: str(formData.get("detail_url")),
    normal_price: num(formData.get("normal_price")),
    supply_price: num(formData.get("supply_price")),
    selling_point: str(formData.get("selling_point")),
    caution: str(formData.get("caution")),
  });

  if (error) redirect("/products?error=save");
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
