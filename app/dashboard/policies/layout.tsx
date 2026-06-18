import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Configure which agent decisions require human approval. Set guardrails for risky tools and operations across your repositories.",
};

export default function PoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
