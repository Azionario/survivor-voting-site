import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Survivor Party Voting",
  description: "Private party voting app"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
