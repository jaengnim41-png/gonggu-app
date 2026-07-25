"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { parseContactWorkbook } from "@/lib/contacts/parse";

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

  // 맨 뒤 순서
  const { data: last } = await supabase
    .from("contacts")
    .select("sort_order")
    .eq("company_id", company.id)
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  const { data: created, error } = await supabase
    .from("contacts")
    .insert({
      company_id: company.id,
      kind,
      name,
      instagram: str(formData.get("instagram")),
      followers: int(formData.get("followers")),
      contact_info: str(formData.get("contact_info")),
      phone: str(formData.get("phone")),
      address: str(formData.get("address")),
      memo: str(formData.get("memo")),
      sort_order: nextOrder,
    })
    .select("id")
    .single();
  if (error || !created) redirect(`${path}?error=save`);

  // 셀러면 선택한 벤더들과 연결(다중)
  if (kind === "셀러") {
    const vendorIds = formData.getAll("vendor_ids").map(String).filter(Boolean);
    if (vendorIds.length) {
      await supabase.from("contact_links").insert(
        vendorIds.map((vid) => ({ company_id: company.id, seller_id: created.id, vendor_id: vid }))
      );
    }
  }

  revalidatePath(path);
  redirect(path);
}

/** 거래처 순서 한 칸 이동 */
export async function moveContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const path = kind === "벤더" ? "/vendors" : "/sellers";
  if (!id || (dir !== "up" && dir !== "down")) redirect(path);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("contacts")
    .select("id, sort_order")
    .eq("company_id", company.id)
    .eq("kind", kind)
    .order("sort_order", { ascending: true });
  if (!list) redirect(path);

  const idx = list.findIndex((c) => c.id === id);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swap < 0 || swap >= list.length) redirect(path);

  await supabase.from("contacts").update({ sort_order: list[swap].sort_order }).eq("id", list[idx].id);
  await supabase.from("contacts").update({ sort_order: list[idx].sort_order }).eq("id", list[swap].id);

  revalidatePath(path);
  redirect(path);
}

/** 셀러↔벤더 연결 추가 (양쪽 어디서든 호출) */
export async function linkContacts(formData: FormData) {
  const sellerId = String(formData.get("seller_id") ?? "");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const back = String(formData.get("back") ?? "/sellers");
  if (!sellerId || !vendorId) redirect(back);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  await supabase
    .from("contact_links")
    .upsert({ company_id: company.id, seller_id: sellerId, vendor_id: vendorId }, { onConflict: "seller_id,vendor_id" });

  revalidatePath(back);
  redirect(back);
}

/** 셀러↔벤더 연결 해제 */
export async function unlinkContacts(formData: FormData) {
  const sellerId = String(formData.get("seller_id") ?? "");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const back = String(formData.get("back") ?? "/sellers");
  if (!sellerId || !vendorId) redirect(back);

  const supabase = await createClient();
  await supabase.from("contact_links").delete().eq("seller_id", sellerId).eq("vendor_id", vendorId);

  revalidatePath(back);
  redirect(back);
}

/** 벤더 담당자 추가 */
export async function addVendorManager(formData: FormData) {
  const vendorId = String(formData.get("vendor_id") ?? "");
  const name = str(formData.get("name"));
  const back = String(formData.get("back") ?? `/contacts/${vendorId}`);
  if (!vendorId || !name) redirect(back);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  await supabase.from("vendor_managers").insert({
    company_id: company.id,
    vendor_id: vendorId,
    name,
    phone: str(formData.get("phone")),
    memo: str(formData.get("memo")),
  });

  revalidatePath(back);
  redirect(back);
}

/** 벤더 담당자 삭제 */
export async function deleteVendorManager(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const back = String(formData.get("back") ?? "/vendors");
  if (!id) redirect(back);
  const supabase = await createClient();
  await supabase.from("vendor_managers").delete().eq("id", id);
  revalidatePath(back);
  redirect(back);
}

/** 거래처 초대 링크 만들기(없으면) — 링크만으로는 열람 불가, 승인해야 열린다 */
export async function createGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  if (!contactId) redirect("/sellers");

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("guest_links")
    .select("id")
    .eq("contact_id", contactId)
    .maybeSingle();

  if (!existing) {
    await supabase.from("guest_links").insert({
      company_id: company.id,
      contact_id: contactId,
      token: crypto.randomUUID().replace(/-/g, ""),
      active: true,
    });
  }
  revalidatePath(`/contacts/${contactId}`);
}

/** 초대 링크 켜기/끄기 */
export async function toggleGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const next = String(formData.get("active") ?? "") === "true";
  const supabase = await createClient();
  await supabase.from("guest_links").update({ active: next }).eq("contact_id", contactId);
  revalidatePath(`/contacts/${contactId}`);
}

/** 초대 링크 재발급 — 기존 링크는 즉시 무효가 된다 */
export async function regenerateGuestLink(formData: FormData) {
  const contactId = String(formData.get("contact_id") ?? "");
  const supabase = await createClient();
  await supabase
    .from("guest_links")
    .update({ token: crypto.randomUUID().replace(/-/g, ""), active: true })
    .eq("contact_id", contactId);
  revalidatePath(`/contacts/${contactId}`);
}

/** 게스트 승인 / 차단 / 대기로 되돌리기 */
export async function setGuestStatus(formData: FormData) {
  const guestId = String(formData.get("guest_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const back = String(formData.get("back") ?? "");
  if (!guestId || !["대기", "승인", "차단"].includes(status)) redirect(back || "/guests");

  const supabase = await createClient();
  await supabase
    .from("guests")
    .update({ status, approved_at: status === "승인" ? new Date().toISOString() : null })
    .eq("id", guestId);

  revalidatePath(back || "/guests");
}

/** 셀러/벤더 정보 수정 */
export async function updateContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const detail = `/contacts/${id}`;
  if (!id) redirect(kind === "벤더" ? "/vendors" : "/sellers");

  const name = str(formData.get("name"));
  if (!name) redirect(`${detail}?error=input`);

  const back = String(formData.get("back") ?? detail);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({
      name,
      instagram: str(formData.get("instagram")),
      followers: int(formData.get("followers")),
      contact_info: str(formData.get("contact_info")),
      phone: str(formData.get("phone")),
      address: str(formData.get("address")),
      memo: str(formData.get("memo")),
    })
    .eq("id", id);
  if (error) redirect(`${back}?error=save`);

  // 셀러면 벤더 연결을 폼 값으로 재설정(다중). vendor_ids가 폼에 있을 때만 반영.
  if (kind === "셀러" && formData.has("vendor_ids")) {
    const vendorIds = formData.getAll("vendor_ids").map(String).filter(Boolean);
    await supabase.from("contact_links").delete().eq("seller_id", id);
    if (vendorIds.length) {
      await supabase.from("contact_links").insert(
        vendorIds.map((vid) => ({ company_id: company.id, seller_id: id, vendor_id: vid }))
      );
    }
  }

  revalidatePath(detail);
  revalidatePath("/vendors");
  revalidatePath("/sellers");
  redirect(back.includes("?") ? back : `${back}?saved=1`);
}

/**
 * 셀러/벤더 엑셀 일괄 등록.
 * 이름+구분으로 매칭하여 없으면 추가, 있으면 갱신(값 있는 칸만).
 * 셀러의 '연결벤더'는 벤더 이름으로 찾아 연결합니다.
 */
export async function bulkUploadContacts(formData: FormData) {
  const defaultKind = String(formData.get("kind") ?? "셀러") === "벤더" ? "벤더" : "셀러";
  const path = defaultKind === "벤더" ? "/vendors" : "/sellers";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`${path}?uerror=file`);

  const { company } = await getSessionProfile();
  if (!company) redirect("/onboarding");

  const bytes = new Uint8Array(await (file as File).arrayBuffer());
  const parsed = parseContactWorkbook(bytes, defaultKind);
  if (parsed.length === 0) redirect(`${path}?uerror=empty`);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("contacts")
    .select("id, name, kind, sort_order")
    .eq("company_id", company.id);
  const byKey = new Map((existing ?? []).map((c) => [c.kind + "|" + c.name, c]));
  const nextOrder: Record<string, number> = {
    셀러: Math.max(-1, ...(existing ?? []).filter((c) => c.kind === "셀러").map((c) => c.sort_order ?? 0)) + 1,
    벤더: Math.max(-1, ...(existing ?? []).filter((c) => c.kind === "벤더").map((c) => c.sort_order ?? 0)) + 1,
  };

  let added = 0;
  const sellerVendorNames: { sellerId: string; vendorNames: string[] }[] = [];

  for (const row of parsed) {
    const key = row.kind + "|" + row.name;
    let id = byKey.get(key)?.id;
    if (!id) {
      const { data: created } = await supabase
        .from("contacts")
        .insert({
          company_id: company.id,
          kind: row.kind,
          name: row.name,
          instagram: row.instagram,
          followers: row.followers,
          phone: row.phone,
          address: row.address,
          memo: row.memo,
          sort_order: nextOrder[row.kind]++,
        })
        .select("id")
        .single();
      if (!created) continue;
      id = created.id;
      byKey.set(key, { id, name: row.name, kind: row.kind, sort_order: 0 });
      added += 1;
    } else {
      const patch: Record<string, unknown> = {};
      if (row.instagram) patch.instagram = row.instagram;
      if (row.followers != null) patch.followers = row.followers;
      if (row.phone) patch.phone = row.phone;
      if (row.address) patch.address = row.address;
      if (row.memo) patch.memo = row.memo;
      if (Object.keys(patch).length) await supabase.from("contacts").update(patch).eq("id", id);
    }
    if (row.kind === "셀러" && row.vendorNames.length) {
      sellerVendorNames.push({ sellerId: id, vendorNames: row.vendorNames });
    }
  }

  // 셀러의 연결벤더를 이름으로 찾아 연결
  if (sellerVendorNames.length) {
    const { data: vendors } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("company_id", company.id)
      .eq("kind", "벤더");
    const vByName = new Map((vendors ?? []).map((v) => [v.name, v.id]));
    const links: { company_id: string; seller_id: string; vendor_id: string }[] = [];
    for (const { sellerId, vendorNames } of sellerVendorNames) {
      for (const vn of vendorNames) {
        const vid = vByName.get(vn);
        if (vid) links.push({ company_id: company.id, seller_id: sellerId, vendor_id: vid });
      }
    }
    if (links.length) {
      await supabase.from("contact_links").upsert(links, { onConflict: "seller_id,vendor_id" });
    }
  }

  revalidatePath(path);
  redirect(`${path}?uok=${added}`);
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
