import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// DESIGN.md: lausanne at 400 only; Inter is the listed substitute.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "cl1ck",
  description: "Finds the work your team repeats and turns it into automations everyone shares.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Toaster theme="light" position="bottom-left" />
      </body>
    </html>
  );
}
