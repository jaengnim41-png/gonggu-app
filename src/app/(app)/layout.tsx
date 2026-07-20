import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/data/profile";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, company } = await getSessionProfile();
  if (!user) redirect("/");
  if (!company) redirect("/onboarding");

  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 바 */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <span className="font-semibold text-slate-900">{company.name}</span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {company.role}
          </span>
          <span className="ml-auto text-sm text-slate-500">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              로그아웃
            </button>
          </form>
        </header>

        <main className="flex-1 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
