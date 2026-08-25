@AGENTS.md
@HANDOFF.md

# 이 프로젝트에 대해

공구허브 — 브랜드가 셀러·벤더와 함께 공동구매를 진행하고 정산하는 웹앱.
사용자(대표님)는 개발자가 아니므로 **설명은 쉬운 우리말로**, 전문용어는 풀어서 씁니다.

- 배포: GitHub `main`에 push하면 Vercel이 자동 배포 (https://gonggu-app-phi.vercel.app)
- 데이터: Supabase (무료 플랜 — 약 1주 미사용 시 자동 일시정지되니 로그인 실패 시 Resume project 안내)
- DB 스키마 변경은 `supabase/schema_*.sql` 파일로 만들고, 사용자가 SQL Editor에서 직접 실행해야 반영됩니다.
- 매출·마진 집계는 반드시 `src/lib/group-buys/totals.ts`의 공용 함수를 쓰고,
  **옵션별 단가표(`group_buy_item_prices`)를 세 번째 인자로 넘겨야** 숫자가 어긋나지 않습니다.
- 작업 후에는 타입 검사(`npx tsc --noEmit`)와 실제 화면 확인까지 하고 배포합니다.

현재 진행 상황과 남은 일은 위 HANDOFF.md를 참고하세요.
