"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // 다음 단계에서 Supabase 로그인에 연결합니다.
    setNotice("로그인 기능은 다음 단계에서 Supabase에 연결됩니다.");
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* 브랜드 */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            공
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">공구허브</h1>
            <p className="mt-1 text-sm text-slate-500">
              공동구매 진행·정산·재고를 한곳에서
            </p>
          </div>
        </div>

        {/* 로그인 카드 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">
            이메일
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            비밀번호
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            로그인
          </button>

          {notice && (
            <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2.5 text-center text-xs font-medium text-indigo-700">
              {notice}
            </p>
          )}

          <p className="mt-5 text-center text-sm text-slate-500">
            계정이 없으신가요?{" "}
            <a href="#" className="font-semibold text-indigo-600 hover:underline">
              회사 만들기
            </a>
          </p>
        </form>

        {/* 원칙 3: 가입 전에 가치 먼저 */}
        <p className="mt-5 text-center text-xs text-slate-400">
          링크만 받으셨나요?{" "}
          <a href="#" className="font-medium text-slate-500 hover:underline">
            로그인 없이 보기
          </a>
        </p>
      </div>
    </main>
  );
}
