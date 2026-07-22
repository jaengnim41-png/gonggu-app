"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 몇 초마다 화면을 새로 고쳐 새 메시지를 가져옵니다(준실시간).
 * 탭이 백그라운드일 때는 쉬고, 돌아오면 즉시 한 번 새로 고칩니다.
 */
export function Poller({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
