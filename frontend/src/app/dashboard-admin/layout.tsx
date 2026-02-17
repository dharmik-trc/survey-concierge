import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin - Survey Concierge",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function DashboardAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
