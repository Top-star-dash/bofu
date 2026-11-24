import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "福美生活馆 · 幸运抽奖", description: "福美生活馆营销互动抽奖活动" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
