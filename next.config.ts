import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 홈 폴더에 있는 다른 package-lock.json 때문에 Next가 프로젝트 위치를 헷갈리지 않도록,
  // 이 앱 폴더를 프로젝트 루트로 고정합니다.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
