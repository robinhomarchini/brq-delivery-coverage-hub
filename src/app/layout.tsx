import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { DeliveryStoreProvider } from "@/store/delivery-store";
import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = {
  title: "BRQ Delivery Coverage Hub",
  description: "Gestão executiva da cobertura da organização de Delivery.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>
          <DeliveryStoreProvider>
            <AppShell>{children}</AppShell>
          </DeliveryStoreProvider>
        </AuthGate>
      </body>
    </html>
  );
}
