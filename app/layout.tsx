import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Team Hub",
  description: "Your ClickUp work for the day, with its Slack channels and files.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
