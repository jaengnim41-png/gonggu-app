"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROLES = ["브랜드", "벤더", "셀러"];

export async function setupCompany(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (!name || !ROLES.includes(role)) {
    redirect("/onboarding?error=input");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("setup_company", {
    p_name: name,
    p_role: role,
  });

  if (error) {
    redirect("/onboarding?error=save");
  }

  redirect("/dashboard");
}
