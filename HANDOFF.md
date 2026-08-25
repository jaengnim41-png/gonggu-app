# 다른 컴퓨터에서 이어서 작업하기

공구허브(gonggu-app) 개발을 다른 PC에서 이어가기 위한 안내서입니다.
**코드·데이터·배포가 전부 클라우드에 있으므로, 새 PC에서는 내려받기만 하면 됩니다.**

## 지금 무엇이 어디에 있나

| 항목 | 위치 | 새 PC에서 |
|---|---|---|
| 소스 코드 | GitHub `jaengnim41-png/gonggu-app` | `git clone` |
| 데이터(제품·공구·주문·정산) | Supabase 클라우드 | 그대로 공유 — 옮길 것 없음 |
| 배포된 웹앱 | Vercel → https://gonggu-app-phi.vercel.app | 그대로 |
| 접속 비밀번호 2개(.env.local) | 이 파일만 GitHub에 없음 | 아래 3번에서 직접 생성 |

## 새 PC 준비 (한 번만)

1. **Node.js LTS 설치** — https://nodejs.org (현재 개발 환경은 v22)
2. **Git 설치** — https://git-scm.com
3. **Claude Code 설치**(AI로 이어서 개발할 경우) — https://claude.com/claude-code

## 프로젝트 내려받기

```bash
git clone https://github.com/jaengnim41-png/gonggu-app.git
cd gonggu-app
npm install
```

> 윈도우 PowerShell에서는 명령을 **한 줄에 하나씩** 실행하세요.
> `cd gonggu-app && npm install` 처럼 `&&`로 붙이면
> `'&&' 토큰은 이 버전에서 올바른 문 구분 기호가 아닙니다` 오류가 납니다.

## .env.local 만들기 (필수)

이 파일은 보안상 GitHub에 올라가지 않으므로 새 PC에서 직접 만듭니다.
프로젝트 폴더 안에 `.env.local` 이름으로 아래 2줄을 넣습니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트ID>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<공개키>
```

값 얻는 곳 (둘 중 편한 쪽):
- **Supabase 대시보드** → 프로젝트 선택 → Project Settings → API → `Project URL`과 `anon/publishable key`
- **Vercel 대시보드** → gonggu-app → Settings → Environment Variables (이미 같은 값이 등록돼 있음)

## 개발 시작

```bash
npm run dev
```
브라우저에서 http://localhost:3000 접속 → 테스트 계정으로 로그인.

## 작업한 내용 반영하기

```bash
git add -A
git commit -m "무엇을 바꿨는지"
git push origin main
```
**push하면 Vercel이 자동으로 다시 배포합니다**(1~2분). 별도 배포 작업 없음.

여러 PC를 오갈 때는 **작업 시작 전 항상** 최신을 받아오세요:
```bash
git pull origin main
```

## 알아둘 점

- **Supabase 무료 플랜은 약 1주 미사용 시 자동 일시정지**됩니다. 로그인이 갑자기 안 되면 Supabase 대시보드에서 **Resume project**를 누르세요(데이터는 보존됩니다).
- **DB 스키마 변경은 SQL 파일로 관리**합니다(`supabase/schema_*.sql`). 새 파일이 추가됐다면 Supabase → SQL Editor에서 실행해야 반영됩니다.
- 같은 프로젝트를 **두 곳에서 동시에 개발하지 마세요**(코드 충돌). 테스트는 어디서든 자유롭게 가능합니다.

## 지금까지 만든 것 (2026-08-21 기준)

대시보드 · 공구(12단계 진행·주문 업로드·판매현황·정산) · 캘린더 · 메시지 ·
제품·재고 통합 관리(엑셀 일괄) · 셀러/벤더(공구 이력·정산액) · 샘플 · 제안서 ·
셀러/벤더 초대 링크 · 모바일 메뉴 · 비밀번호 재설정 · 삭제 확인창.

## 아직 안 끝난 일

- [ ] `supabase/schema_19_seller_supply.sql` **SQL Editor에서 실행** — 셀러공급가 저장 칸 추가(미실행 시 셀러공급가 입력만 안 됨)
- [ ] Supabase → Authentication → URL Configuration → Redirect URLs에
      `https://gonggu-app-phi.vercel.app/reset-password` 추가(비밀번호 재설정 메일 링크용)
- [ ] 셀러 공급가 값 채우기(현재 벤더 공급가만 입력됨)
- [ ] 실제 재고 수량 입력(엑셀 `현재재고` 칸)
- [ ] 가격 미입력 품목: 구형 네일트리머, 안전문 부품류, 샤워핸들, 자동차 필터,
      서랍잠금장치, 4·5·6세대 안전문
- [ ] 거래처(셀러·벤더) 명단 엑셀 일괄 등록

