import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { APP } from "@/constants/app";
import "./globals.css";

/** §4: Outfit para display, Inter para interface. Nenhuma outra família. */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP.name,
  description: "Gestão da rede credenciada Vegas Card.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4D56A1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${inter.variable}`}>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-[var(--vg-radius-sm)] focus:bg-[var(--vg-surface)] focus:px-3 focus:py-2"
        >
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
