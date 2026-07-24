import "./styles.css";
import { Instrument_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

// Console design language (from the RealLoop hi-fi wireframes): Instrument
// Sans body, Space Grotesk numerals/headings, Plex Mono for ids.
const instrument = Instrument_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono" });

export const metadata = {
  title: "realloop · Call Audit",
  description: "Calibrated human + LLM evaluation for voice agents"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrument.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

