"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError("로그인에 실패했습니다. 이메일과 비밀번호를 확인해 주세요.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError("가입에 실패했습니다. " + error.message);
        setLoading(false);
        return;
      }
      if (data.session) {
        // 이메일 확인이 꺼져 있으면 바로 로그인됩니다.
        router.push("/dashboard");
        router.refresh();
      } else {
        // 이메일 확인이 켜져 있으면 확인 메일을 보냅니다.
        setInfo("가입 확인 메일을 보냈어요. 메일의 링크를 눌러 인증한 뒤 로그인해 주세요.");
        setLoading(false);
      }
    }
  }

  const isSignup = mode === "signup";

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

        {/* 로그인 / 가입 카드 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            {isSignup ? "회사 만들기 · 계정 생성" : "로그인"}
          </h2>

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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "잠시만요…" : isSignup ? "계정 만들기" : "로그인"}
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-center text-xs font-medium text-rose-700">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-4 rounded-lg bg-indigo-50 px-3 py-2.5 text-center text-xs font-medium text-indigo-700">
              {info}
            </p>
          )}

          <p className="mt-5 text-center text-sm text-slate-500">
            {isSignup ? "이미 계정이 있으신가요? " : "계정이 없으신가요? "}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                setError(null);
                setInfo(null);
              }}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {isSignup ? "로그인" : "회사 만들기"}
            </button>
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
