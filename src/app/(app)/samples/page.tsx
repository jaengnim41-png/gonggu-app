import { createClient } from "@/lib/supabase/server";
import { SampleForm } from "@/components/sample-form";
import { createSample } from "./actions";
import { SampleTable, type SampleRow } from "./sample-table";

type Sample = {
  id: string;
  contact_id: string | null;
  product_id: string | null;
  product_option_id: string | null;
  item_text: string | null;
  quantity: number;
  sent_at: string;
  courier: string | null;
  tracking_no: string | null;
  returned: boolean;
  returned_at: string | null;
  memo: string | null;
};

type SP = {
  error?: string;
  from?: string;
  to?: string;
  contact?: string;
  product?: string;
  unit?: string; // day | week | month | year
};

/** ISO 주차 라벨 (YYYY-Www) */
function weekLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7; // 월=0
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function periodKey(dateStr: string, unit: string): string {
  if (!dateStr) return "—";
  if (unit === "year") return dateStr.slice(0, 4) + "년";
  if (unit === "month") return dateStr.slice(0, 7);
  if (unit === "week") return weekLabel(dateStr);
  return dateStr; // day
}

export default async function SamplesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { error, from, to, contact, product, unit: unitRaw } = await searchParams;
  const unit = ["day", "week", "month", "year"].includes(unitRaw ?? "") ? unitRaw! : "month";
  const supabase = await createClient();

  const [{ data: sData }, { data: cData }, { data: pData }, { data: oData }] = await Promise.all([
    supabase
      .from("sample_shipments")
      .select("id, contact_id, product_id, product_option_id, item_text, quantity, sent_at, courier, tracking_no, returned, returned_at, memo")
      .order("sent_at", { ascending: false }),
    supabase.from("contacts").select("id, name, kind").order("sort_order"),
    supabase.from("products").select("id, name").order("sort_order"),
    supabase.from("product_options").select("id, product_id, name").order("sort_order"),
  ]);

  const all = (sData ?? []) as Sample[];
  const contacts = (cData ?? []) as { id: string; name: string; kind: string }[];
  const products = (pData ?? []) as { id: string; name: string }[];
  const options = (oData ?? []) as { id: string; product_id: string; name: string }[];

  const contactName = new Map(contacts.map((c) => [c.id, c]));
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const optionName = new Map(options.map((o) => [o.id, o.name]));

  const items: { value: string; label: string }[] = [];
  for (const p of products) {
    items.push({ value: `p:${p.id}`, label: p.name });
    for (const o of options.filter((x) => x.product_id === p.id)) {
      items.push({ value: `o:${o.id}:${p.id}`, label: `${p.name} · ${o.name}` });
    }
  }

  function itemLabelOf(s: Sample) {
    if (s.product_option_id) {
      const p = s.product_id ? productName.get(s.product_id) : null;
      const o = optionName.get(s.product_option_id);
      return [p, o].filter(Boolean).join(" · ") || s.item_text || "—";
    }
    if (s.product_id) return productName.get(s.product_id) ?? s.item_text ?? "—";
    return s.item_text ?? "—";
  }
  function itemValueOf(s: Sample) {
    if (s.product_option_id && s.product_id) return `o:${s.product_option_id}:${s.product_id}`;
    if (s.product_id) return `p:${s.product_id}`;
    return "";
  }

  // 필터 적용
  const filtered = all.filter((s) => {
    if (from && s.sent_at < from) return false;
    if (to && s.sent_at > to) return false;
    if (contact && s.contact_id !== contact) return false;
    if (product && s.product_id !== product) return false;
    return true;
  });

  // 기간별 집계
  const byPeriod = new Map<string, { count: number; qty: number }>();
  for (const s of filtered) {
    const k = periodKey(s.sent_at, unit);
    const cur = byPeriod.get(k) ?? { count: 0, qty: 0 };
    cur.count += 1;
    cur.qty += s.quantity ?? 0;
    byPeriod.set(k, cur);
  }
  const periods = [...byPeriod.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  const totalQty = filtered.reduce((n, s) => n + (s.quantity ?? 0), 0);
  const returnedCount = filtered.filter((s) => s.returned).length;

  const rows: SampleRow[] = filtered.map((s) => {
    const c = s.contact_id ? contactName.get(s.contact_id) : null;
    return {
      id: s.id,
      contact_id: s.contact_id,
      contactName: c?.name ?? null,
      contactKind: c?.kind ?? null,
      itemValue: itemValueOf(s),
      itemLabel: itemLabelOf(s),
      item_text: s.item_text,
      quantity: s.quantity,
      sent_at: s.sent_at,
      courier: s.courier,
      tracking_no: s.tracking_no,
      returned: s.returned,
      returned_at: s.returned_at,
      memo: s.memo,
    };
  });

  const selectCls = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";
  const unitLabel: Record<string, string> = { day: "일별", week: "주간", month: "월별", year: "연도별" };

  // 현재 필터를 유지하며 unit만 바꾸는 쿼리스트링
  const qsFor = (u: string) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (contact) p.set("contact", contact);
    if (product) p.set("product", product);
    p.set("unit", u);
    return "?" + p.toString();
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">샘플</h1>
      <p className="mt-1 text-sm text-slate-500">
        셀러·벤더에게 보낸 샘플을 기록합니다. 기간·거래처·제품으로 걸러 보고, 기간 단위로 집계할 수 있습니다.
      </p>

      {/* 요약 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "발송 (필터 적용)", value: `${filtered.length}건`, sub: `수량 ${totalQty.toLocaleString("ko-KR")}개` },
          { label: "기간 구간", value: `${periods.length}개`, sub: unitLabel[unit] + " 집계" },
          { label: "회수됨", value: `${returnedCount}건`, sub: "회수는 드문 경우" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <form className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-xs font-medium text-slate-600">시작일<input type="date" name="from" defaultValue={from ?? ""} className={selectCls + " mt-1 block"} /></label>
        <label className="text-xs font-medium text-slate-600">종료일<input type="date" name="to" defaultValue={to ?? ""} className={selectCls + " mt-1 block"} /></label>
        <label className="text-xs font-medium text-slate-600">
          거래처
          <select name="contact" defaultValue={contact ?? ""} className={selectCls + " mt-1 block"}>
            <option value="">전체</option>
            <optgroup label="셀러">{contacts.filter((c) => c.kind === "셀러").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            <optgroup label="벤더">{contacts.filter((c) => c.kind === "벤더").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          제품
          <select name="product" defaultValue={product ?? ""} className={selectCls + " mt-1 block"}>
            <option value="">전체</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <input type="hidden" name="unit" value={unit} />
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">적용</button>
        <a href="/samples" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">초기화</a>
      </form>

      {/* 기간별 집계 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">기간별 발송</h2>
          <div className="flex gap-1">
            {(["day", "week", "month", "year"] as const).map((u) => (
              <a key={u} href={qsFor(u)}
                className={"rounded-md px-2.5 py-1 text-xs " + (unit === u ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")}>
                {unitLabel[u]}
              </a>
            ))}
          </div>
        </div>
        {periods.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">해당 기간에 발송 기록이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">{unitLabel[unit]}</th>
                  <th className="px-3 py-2 text-right">발송 건수</th>
                  <th className="px-3 py-2 text-right">수량</th>
                </tr>
              </thead>
              <tbody>
                {periods.map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">{k}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.qty.toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 발송 기록 추가 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 샘플 발송 기록</summary>
        <SampleForm action={createSample} contacts={contacts} items={items} back="/samples" />
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "받는 곳이나 품목 중 하나는 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 발송 목록 (필터 적용) */}
      <h2 className="mt-8 text-sm font-bold text-slate-900">발송 목록 ({rows.length})</h2>
      <div className="mt-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">
            조건에 맞는 발송 기록이 없습니다.
          </div>
        ) : (
          <SampleTable rows={rows} contacts={contacts} items={items} back="/samples" />
        )}
      </div>
    </div>
  );
}
