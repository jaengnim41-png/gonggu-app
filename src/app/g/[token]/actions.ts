"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAnonClient } from "@/lib/supabase/anon";

const COOKIE = "gonggu_guest_key";

/** 이 브라우저(기기)를 알아보는 무작위 키. 없으면 만들어 1년간 저장. */
export async function getDeviceKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  return "";
}

/** 첫 입장: 이름을 남겨 승인 요청을 만든다. */
export async function requestAccess(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!token || !name) redirect(`/g/${token}?error=name`);

  const jar = await cookies();
  let key = jar.get(COOKIE)?.value;
  if (!key) {
    key = crypto.randomUUID().replace(/-/g, "");
    jar.set(COOKIE, key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }

  const supabase = createAnonClient();
  await supabase.rpc("guest_enter", {
    p_token: token,
    p_device_key: key,
    p_name: name,
  });

  revalidatePath(`/g/${token}`);
  redirect(`/g/${token}`);
}

/** 게스트가 메시지 보내기 */
export async function guestSend(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const jar = await cookies();
  const key = jar.get(COOKIE)?.value;
  if (!token || !body || !key) redirect(`/g/${token}?tab=${encodeURIComponent("메시지")}`);

  const supabase = createAnonClient();
  await supabase.rpc("guest_post_message", {
    p_token: token,
    p_device_key: key,
    p_body: body,
  });

  revalidatePath(`/g/${token}`);
  redirect(`/g/${token}?tab=${encodeURIComponent("메시지")}`);
}
