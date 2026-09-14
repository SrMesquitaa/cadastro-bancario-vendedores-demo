import { Sora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

export const metadata = {
  title: "Cadastro Bancário — NovaVenda",
  description: "Cadastro de dados bancários para pagamento de comissão",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className={`${sora.variable} h-dvh antialiased`}>
        <body className="min-h-dvh flex flex-col bg-neutral-50 font-sans">
          {children}
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
