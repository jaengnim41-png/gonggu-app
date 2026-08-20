import { redirect } from "next/navigation";

/** 재고는 제품·재고 통합 화면으로 합쳐졌습니다. 옛 주소로 들어와도 그리로 보냅니다. */
export default function InventoryPage() {
  redirect("/products");
}
