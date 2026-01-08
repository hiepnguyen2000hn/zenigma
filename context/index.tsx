"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { privyAppId, config } from "@/config";
import React, { type ReactNode } from "react";
import BalanceProvider from "@/components/BalanceProvider";
import { sepolia } from "wagmi/chains";

// Set up queryClient
const queryClient = new QueryClient();

if (!privyAppId) {
  throw new Error("Privy App ID is not defined");
}

function ContextProvider({
  children,
}: {
  children: ReactNode;
  cookies?: string | null;
}) {
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
        },
        loginMethods: ["email", "wallet", "google"],
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: sepolia,
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <BalanceProvider>
            {children}
          </BalanceProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default ContextProvider;
