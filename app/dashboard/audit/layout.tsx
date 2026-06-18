import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit Trail",
  description:
    "Immutable record of every agent action, decision, and approval. Filter by date, expand for arguments, and export as JSON.",
};

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
