export type ProposalItemLike = {
  name: string;
  option_label: string | null;
  detail_url?: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  fee_rate: number | null;
};

/**
 * 제안서 한 줄의 파생 값(할인율·벤더 공급가·마진)을 계산합니다.
 * - 마진 = 공구가 × 수수료율   (예: 16900 × 0.25 = 4225)
 * - 공급가 = 공구가 − 마진      (예: 16900 − 4225 = 12675)
 * - 할인율 = 1 − 공구가/정상가
 */
export function calcRow(it: ProposalItemLike) {
  const gonggu = it.gonggu_price ?? 0;
  const normal = it.normal_price ?? 0;
  const fee = it.fee_rate ?? 0;
  const margin = Math.round(gonggu * fee);
  const supply = gonggu - margin;
  const discount = normal > 0 ? 1 - gonggu / normal : 0;
  return { gonggu, normal, fee, margin, supply, discount };
}

export function won(n: number | null | undefined) {
  return n == null ? "—" : "₩" + Math.round(n).toLocaleString("ko-KR");
}

export function pct(ratio: number) {
  return `${Math.round(ratio * 1000) / 10}%`;
}
