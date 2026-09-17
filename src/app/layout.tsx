import type { Metadata } from "next";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "MatureX - Financial Dashboard",
  description: "Báo cáo tài chính đa team MatureX (EC, Flowa, Microm, Pocdy)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground selection:bg-foreground selection:text-background">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
