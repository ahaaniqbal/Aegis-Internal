import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Approvals",
  description:
    "Review and action agent requests that need human approval. Approve or deny risky operations in one click.",
};

export default function ApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
