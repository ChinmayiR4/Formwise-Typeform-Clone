import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import { ToastProvider } from "@/components/ui/Toast";
import { SlowServerNotice } from "@/components/SlowServerNotice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formwise — conversational forms",
  description: "Build beautiful one-question-at-a-time forms, share a link, and see results.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <ToastProvider>
          <SlowServerNotice />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
