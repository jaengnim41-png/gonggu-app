"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "reset";

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

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError("메일 발송에 실패했습니다. 이메일을 확인해 주세요.");
        setLoading(false);
        return;
      }
      setInfo("비밀번호 재설정 메일을 보냈어요. 메일의 링크를 눌러 새 비밀번호를 정해 주세요.");
      setLoading(false);
      return;
    }

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
  const isReset = mode === "reset";

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
            {isSignup ? "회사 만들기 · 계정 생성" : isReset ? "비밀번호 재설정" : "로그인"}
          </h2>

          {isReset && (
            <p className="mb-3 text-xs text-slate-500">
              가입한 이메일을 넣으면 새 비밀번호를 정할 수 있는 링크를 보내드립니다.
            </p>
          )}

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

          {!isReset && (
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
          )}

          {mode === "signin" && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(null); setInfo(null); }}
                className="text-xs text-slate-500 hover:text-indigo-600 hover:underline"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "잠시만요…" : isSignup ? "계정 만들기" : isReset ? "재설정 메일 보내기" : "로그인"}
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
            {isReset ? (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
                className="font-semibold text-indigo-600 hover:underline"
              >
                ← 로그인으로 돌아가기
              </button>
            ) : (
              <>
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
              </>
            )}
          </p>
        </form>

        <p className="mt-5 text-center text-xs text-slate-400">
          셀러·벤더는 브랜드가 보내준 초대 링크로 접속하세요.
        </p>
      </div>
    </main>
  );
}
