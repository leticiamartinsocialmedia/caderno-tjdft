import type { Metadata, Viewport } from "next";
import { Mulish, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const mulish = Mulish({ subsets: ["latin"], variable: "--font-mulish", display: "swap" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap" });

export const metadata: Metadata = {
  title: "Caderno TJDFT",
  description: "Organização de estudos para o concurso do TJDFT",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0C",
};

// Aplica o tema salvo antes da primeira pintura, para não piscar.
const scriptTema = `try{if(localStorage.getItem('tema')==='escuro')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${mulish.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
