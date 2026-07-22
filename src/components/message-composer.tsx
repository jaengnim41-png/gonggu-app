"use client";

import { useRef } from "react";

/**
 * 메시지 입력창. Enter로 전송(Shift+Enter는 줄바꿈), 전송 후 입력창을 비웁니다.
 * action은 서버 액션(우리 쪽) 또는 게스트용 액션 어느 쪽이든 받습니다.
 */
export function MessageComposer({
  action,
  hidden,
  placeholder = "메시지를 입력하세요",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  placeholder?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={() => {
        // 서버 액션이 실행된 뒤 입력창 비우기
        setTimeout(() => formRef.current?.reset(), 0);
      }}
      className="flex items-end gap-2 border-t border-slate-200 bg-white p-3"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <textarea
        name="body"
        rows={2}
        required
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        className="min-w-0 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        보내기
      </button>
    </form>
  );
}
