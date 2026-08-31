import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Commerce Agent",
  description: "AI-powered commerce application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
