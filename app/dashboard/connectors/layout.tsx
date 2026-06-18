import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connectors",
  description:
    "Govern every tool your agents touch. Aegis is expanding beyond GitHub with first-class MCP integrations for Slack, Linear, Jira, GitHub Actions, Terraform, and PostgreSQL.",
};

export default function ConnectorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
