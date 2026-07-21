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
