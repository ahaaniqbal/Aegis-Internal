import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Freeze Windows",
  description:
    "Schedule when your agents pause activity. Set timezone-aware blocks for nights, weekends, and on-call periods.",
};

export default function FreezeWindowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
