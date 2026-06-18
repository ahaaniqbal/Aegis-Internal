import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rooms",
  description:
    "Team workspaces where AI agents operate. Set per-role tool permissions, invite collaborators, and manage integration URLs.",
};

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
