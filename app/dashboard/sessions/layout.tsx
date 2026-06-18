import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sessions",
  description:
    "Agent working sessions grouped by conversation. Inspect tool usage, decisions, and outcomes per session.",
};

export default function SessionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
