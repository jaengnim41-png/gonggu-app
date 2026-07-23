"use client";

/**
 * 샘플 발송 등록 폼.
 * 품목은 등록된 제품·옵션에서 고르거나, 목록에 없으면 직접 적을 수 있습니다.
 */
export function SampleForm({
  action,
  contacts,
  items,
  back,
  fixedContactId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  contacts: { id: string; name: string; kind: string }[];
  items: { value: string; label: string }[];
  back: string;
  fixedContactId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const sellers = contacts.filter((c) => c.kind === "셀러");
  const vendors = contacts.filter((c) => c.kind === "벤더");

  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="back" value={back} />
      {fixedContactId && <input type="hidden" name="contact_id" value={fixedContactId} />}

      {!fixedContactId && (
        <label className="text-sm font-medium text-slate-700">
          받는 곳
          <select name="contact_id" defaultValue="" className={inputCls}>
            <option value="">— 선택 안 함</option>
            {sellers.length > 0 && (
              <optgroup label="셀러">
                {sellers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {vendors.length > 0 && (
              <optgroup label="벤더">
                {vendors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      )}

      <label className="text-sm font-medium text-slate-700">
        품목 (등록된 제품)
        <select name="item" defaultValue="" className={inputCls}>
          <option value="">— 아래에 직접 입력</option>
          {items.map((it) => (
            <option key={it.value} value={it.value}>{it.label}</option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-slate-700">
        품목 직접 입력
        <input name="item_text" placeholder="예: 케어백2 트위드 블랙 (샘플용)" className={inputCls} />
      </label>

      <label className="text-sm font-medium text-slate-700">
        수량
        <input name="quantity" inputMode="numeric" defaultValue="1" className={inputCls} />
      </label>

      <label className="text-sm font-medium text-slate-700">
        발송일
        <input type="date" name="sent_at" defaultValue={today} className={inputCls} />
      </label>

      <label className="text-sm font-medium text-slate-700">
        택배사
        <input name="courier" placeholder="예: CJ대한통운" className={inputCls} />
      </label>

      <label className="text-sm font-medium text-slate-700">
        송장번호
        <input name="tracking_no" inputMode="numeric" className={inputCls} />
      </label>

      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        메모 · 특이사항
        <input
          name="memo"
          placeholder="예: 촬영용으로 요청, 8월 공구 검토 중 / 회수 요청함"
          className={inputCls}
        />
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          발송 기록 추가
        </button>
      </div>
    </form>
  );
}
