import { createClient } from "@/lib/supabase/server";
import { CalendarView, type CalEntry } from "./calendar-view";

export default async function CalendarPage() {
  const supabase = await createClient();
  const [{ data: gbData }, { data: itemData }, { data: gbcData }, { data: contactData }] =
    await Promise.all([
      supabase.from("group_buys").select("id, title, status, start_date, end_date"),
      supabase.from("group_buy_items").select("group_buy_id, product_name"),
      supabase.from("group_buy_contacts").select("group_buy_id, role, contact_id"),
      supabase.from("contacts").select("id, name"),
    ]);

  const contactName = new Map(((contactData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const productsByGb = new Map<string, Set<string>>();
  for (const it of (itemData ?? []) as { group_buy_id: string; product_name: string }[]) {
    if (!productsByGb.has(it.group_buy_id)) productsByGb.set(it.group_buy_id, new Set());
    productsByGb.get(it.group_buy_id)!.add(it.product_name);
  }
  const sellersByGb = new Map<string, string[]>();
  const vendorsByGb = new Map<string, string[]>();
  for (const gc of (gbcData ?? []) as { group_buy_id: string; role: string; contact_id: string }[]) {
    const name = contactName.get(gc.contact_id);
    if (!name) continue;
    const map = gc.role === "셀러" ? sellersByGb : vendorsByGb;
    const arr = map.get(gc.group_buy_id) ?? [];
    arr.push(name);
    map.set(gc.group_buy_id, arr);
  }

  const entries: CalEntry[] = ((gbData ?? []) as { id: string; title: string; status: string; start_date: string | null; end_date: string | null }[]).map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    start_date: g.start_date,
    end_date: g.end_date,
    products: [...(productsByGb.get(g.id) ?? [])],
    sellers: sellersByGb.get(g.id) ?? [],
    vendors: vendorsByGb.get(g.id) ?? [],
  }));

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <h1 className="text-lg font-bold text-slate-900">캘린더</h1>
      <p className="mt-1 text-sm text-slate-500">
        공구 일정을 달력으로 봅니다. 진행 기간 내내 칸에 표시되고, 막대에 셀러·제품이 함께 나옵니다.
      </p>
      <div className="mt-6">
        <CalendarView entries={entries} />
      </div>
    </div>
  );
}
