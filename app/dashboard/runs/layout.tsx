import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Runs",
  description:
    "Every agent action across your repositories in real time. Filter by agent, tool, decision, or repository, and inspect arguments for each call.",
};

export default function RunsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
