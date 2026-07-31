"use client";

/**
 * 폼 제출 전에 확인 창을 띄우는 버튼.
 * 서버 액션 form 안의 삭제 버튼을 이걸로 바꾸면 "정말 삭제할까요?"를 먼저 묻습니다.
 * 취소하면 제출을 막습니다.
 */
export function ConfirmButton({
  children,
  message = "정말 삭제할까요? 되돌릴 수 없습니다.",
  className,
  title,
}: {
  children: React.ReactNode;
  message?: string;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="submit"
      title={title}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
