"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false); // 재설정 세션이 있는지
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 메일 링크로 들어오면 Supabase가 복구(recovery) 세션을 만들어 둡니다.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    if (password !== confirm) { setError("두 비밀번호가 다릅니다."); return; }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError("변경에 실패했습니다. 링크가 만료되었을 수 있어요. 재설정 메일을 다시 요청해 주세요.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1200);
  }

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">공</div>
          <h1 className="text-xl font-bold text-slate-900">비밀번호 재설정</h1>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {done ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-3 text-center text-sm font-medium text-emerald-700">
              비밀번호가 변경됐어요. 잠시 후 대시보드로 이동합니다.
            </p>
          ) : !ready ? (
            <div className="text-center text-sm text-slate-500">
              <p>재설정 링크를 확인하는 중입니다…</p>
              <p className="mt-2 text-xs text-slate-400">
                이 화면이 계속 보이면 링크가 만료됐을 수 있어요.{" "}
                <a href="/" className="text-indigo-600 hover:underline">로그인 화면에서 다시 요청</a>해 주세요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                새 비밀번호
                <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" className={inputCls} />
              </label>
              <label className="mt-4 block text-sm font-medium text-slate-700">
                새 비밀번호 확인
                <input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="한 번 더 입력" className={inputCls} />
              </label>
              <button type="submit" disabled={loading} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {loading ? "변경 중…" : "비밀번호 변경"}
              </button>
              {error && (
                <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-center text-xs font-medium text-rose-700">{error}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
