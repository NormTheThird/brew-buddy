import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { getCurrentUser } from "@/lib/auth/session";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Brew Buddy",
  description: "Homebrew, measured.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};

export const viewport = {
  themeColor: "#24272e",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The signed-in user's theme drives the accent variables site-wide;
  // logged-out pages get the Copper default.
  const user = await getCurrentUser();
  return (
    <html lang="en" data-theme={user?.theme ?? "copper"}>
      <body className={roboto.className}>{children}</body>
    </html>
  );
}
