import type { Metadata } from "next"
import type React from "react"

import { Toaster } from "sonner"
import "./globals.css"

import { Russo_One, Chakra_Petch, Geist_Mono } from "next/font/google"

const russo = Russo_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-heading",
  display: "swap",
})

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Parego - Chess Tournament Pairing",
  description:
    "Pair. Play. Go. Simple over-the-board chess tournament management with instant pairing and easy join links.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${russo.variable} ${chakra.variable} ${geistMono.variable} font-sans antialiased`}
        suppressHydrationWarning
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
