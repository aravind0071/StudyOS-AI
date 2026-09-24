import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    default: "StudyOS AI — Your Knowledge. Your Tutor. Your Learning Intelligence.",
    template: "%s | StudyOS AI",
  },
  description:
    "StudyOS AI is a multimodal AI-powered personal learning platform that transforms scattered study materials into an intelligent, personalized learning environment.",
  keywords: [
    "AI tutor", "study assistant", "RAG", "knowledge graph", "adaptive quiz",
    "exam readiness", "interview prep", "student learning", "AI education",
  ],
  authors: [{ name: "StudyOS AI" }],
  openGraph: {
    title: "StudyOS AI",
    description: "Your Knowledge. Your Tutor. Your Learning Intelligence.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-slate-50 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200 min-h-screen transition-colors duration-200">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            },
          }}
        />
      </body>
    </html>
  );
}
