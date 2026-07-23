import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { saveSettings } from "../actions";

type Settings = {
  brand_name: string | null;
  store_url: string | null;
  courier: string | null;
  base_ship_fee: number | null;
  extra_ship_fee: number | null;
  return_fee: number | null;
  same_day: string | null;
  sample_support: string | null;
  cs_note: string | null;
  ship_from: string | null;
  progress_note: string | null;
  settle_note: string | null;
  event_note: string | null;
  contact_note: string | null;
};

export default async function ProposalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("proposal_settings").select("*").maybeSingle();
  const s = (data ?? {}) as Partial<Settings>;

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const areaCls = inputCls + " min-h-20";

  const text = (name: keyof Settings, label: string, placeholder = "") => (
    <label className="text-sm font-medium text-slate-700">
      {label}
      <input name={name} defaultValue={(s[name] as string) ?? ""} placeholder={placeholder} className={inputCls} />
    </label>
  );
  const area = (name: keyof Settings, label: string, placeholder = "") => (
    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
      {label}
      <textarea name={name} defaultValue={(s[name] as string) ?? ""} placeholder={placeholder} className={areaCls} />
    </label>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link href="/proposals" className="text-sm text-slate-500 hover:text-indigo-600">← 제안서 목록</Link>
      <h1 className="mt-3 text-lg font-bold text-slate-900">제안서 공통 정보</h1>
      <p className="mt-1 text-sm text-slate-500">
        한 번 저장하면 모든 제안서 위·아래에 자동으로 들어갑니다. 제안서마다 다시 적을 필요 없습니다.
      </p>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">저장했습니다.</p>
      )}

      <form action={saveSettings} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">공급업체 정보</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {text("brand_name", "브랜드", "예: uddyu")}
            {text("store_url", "스마트스토어 URL", "https://smartstore.naver.com/uddyu")}
            {text("courier", "택배사", "예: 롯데택배")}
            {text("same_day", "당일배송 조건", "예: 2시 이전 주문건")}
            {text("base_ship_fee", "기본 택배비", "예: 3500")}
            {text("extra_ship_fee", "제주/도서산간 추가", "예: 6000")}
            {text("return_fee", "환불 왕복 택배비", "예: 6000")}
            {text("ship_from", "출고/반품지", "예: 충북 옥천군 …")}
            {area("sample_support", "샘플지원 여부", "예: 콩딱 a,b타입 각 2개세트 / 케어백 5개 …")}
            {area("cs_note", "고객센터 · CS", "예: 네이버 톡톡 (전화상담 운영X)")}
            {area("contact_note", "담당자 연락", "예: 공구 담당 오픈채팅 https://open.kakao.com/…")}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">하단 안내</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {area("progress_note", "공구 진행 방법", "예: 3~5일 진행 / 릴스·피드 노출 / @uddyu.official 태그 필수")}
            {area("settle_note", "정산 안내", "예: 공구 후 2주 뒤 정산 / 네이버 수수료 3.495% 제외")}
            {area("event_note", "이벤트", "예: 케어백 1개+비닐 2매 증정 …")}
          </div>
        </section>

        <button type="submit" className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
          저장
        </button>
      </form>
    </div>
  );
}
