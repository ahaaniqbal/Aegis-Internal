import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your Aegis account password.",
};

export default function AuthResetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
