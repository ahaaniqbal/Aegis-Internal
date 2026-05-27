import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Spenditure",
  description:
    "Track input and output token usage across agents and sessions. Compare costs with and without Aegis governance.",
};

export default function TokenSpenditureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
