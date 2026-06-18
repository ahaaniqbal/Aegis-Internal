import type { Metadata } from "next";
import OnboardingDemoShell from "./OnboardingDemoShell";

export const metadata: Metadata = {
  title: "Set up your workspace",
  description:
    "Connect your GitHub repositories and configure your first agent governance policies.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // OnboardingDemoShell is a thin client wrapper that installs the
  // preview-data mocks when `?demo=1` / `?preview=1` / `aegis_demo === 'true'`
  // is present, and renders a small ribbon so designers know they're in
  // preview mode. Real users hit the unpatched API and see the actual flow.
  return <OnboardingDemoShell>{children}</OnboardingDemoShell>;
}
