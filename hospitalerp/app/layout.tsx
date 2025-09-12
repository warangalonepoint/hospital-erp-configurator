import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hospital ERP — Configurator",
  description: "Feature configurator for Hospital PWA ERP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // set theme class ASAP to avoid flash
  const themeBoot = `
    (function(){
      try {
        var t = localStorage.getItem('theme') || 'dark';
        var el = document.documentElement;
        el.classList.remove('theme-dark','theme-light');
        el.classList.add(t === 'light' ? 'theme-light' : 'theme-dark');
      } catch(e){}
    })();
  `;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
