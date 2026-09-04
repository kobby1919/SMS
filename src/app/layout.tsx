import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Edujay",
  description: "Modern School Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html
        lang="en"
        className="h-full antialiased"
      >
        <body className="min-h-full flex flex-col font-nunito">{children}</body>
      </html>
    </ClerkProvider>
  );
}
