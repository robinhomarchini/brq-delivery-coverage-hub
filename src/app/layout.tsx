import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { DeliveryStoreProvider } from "@/store/delivery-store";
import { AuthGate } from "@/components/auth/auth-gate";

export const metadata: Metadata = {
  title: "BRQ Delivery Coverage Hub",
  description: "Gestão executiva da cobertura da organização de Delivery.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
