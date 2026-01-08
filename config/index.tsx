import { http, createConfig } from "wagmi";
import { mainnet, arbitrum, polygon, base, optimism, sepolia } from "wagmi/chains";

// Get Privy App ID from environment variables
export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

if (!privyAppId) {
  throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not defined");
}

// Chain metadata với ảnh
export const chainMetadata: Record<number, { name: string; imageUrl: string; gradient: string }> = {
  1: {
    name: "Ethereum",
    imageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
    gradient: "from-blue-500 to-blue-600"
  },
  11155111: {
    name: "Sepolia",
    imageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png",
    gradient: "from-purple-400 to-purple-500"
  },
  42161: {
    name: "Arbitrum",
    imageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/11841.png",
    gradient: "from-blue-400 to-blue-500"
  },
  137: {
    name: "Polygon",
    imageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/3890.png",
    gradient: "from-purple-500 to-purple-600"
  },
  8453: {
    name: "Base",
    imageUrl: "https://avatars.githubusercontent.com/u/108554348?s=280&v=4",
    gradient: "from-blue-600 to-blue-700"
  },
  10: {
    name: "Optimism",
    imageUrl: "https://s2.coinmarketcap.com/static/img/coins/64x64/11840.png",
    gradient: "from-red-500 to-red-600"
  }
};

// Wagmi config for Privy
export const config = createConfig({
  chains: [sepolia, mainnet, arbitrum, polygon, base, optimism],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [polygon.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
  },
});