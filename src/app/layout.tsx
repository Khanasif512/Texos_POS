import type { Metadata } from "next"
import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google"
import { Providers } from "@/components/shared/providers"
import "./globals.css"

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })
const bengali = Noto_Sans_Bengali({ variable: "--font-bengali", subsets: ["bengali"], weight: ["400", "500", "600", "700"] })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "TexonPOS — Import, Inventory & POS for growing traders", template: "%s · TexonPOS" },
  description:
    "Cloud POS built for importers: LC management, automatic landed-cost calculation, multi-branch inventory, cash & credit invoicing, and real-time profit reports.",
  applicationName: "TexonPOS",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${bengali.variable} h-full`}>
      <body className="min-h-full bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
