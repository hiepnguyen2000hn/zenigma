"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import { Wallet } from "lucide-react";
import { useEffect } from "react";
import { auth } from "@/lib/api";

interface ConnectButtonProps {
    className?: string;
    onClick?: () => void;
}

const ConnectButton = ({ className = "", onClick }: ConnectButtonProps) => {
    const { authenticated, user, getAccessToken } = usePrivy();

    const { login } = useLogin({
        onComplete: async (user, isNewUser, wasAlreadyAuthenticated, loginMethod, loginAccount) => {
            try {
                console.log("Login completed:", {
                    user,
                    isNewUser,
                    wasAlreadyAuthenticated,
                    loginMethod,
                    loginAccount,
                });

                // Lấy Privy access token
                const privyToken = await getAccessToken();

                if (!privyToken) {
                    console.error("Failed to get Privy access token");
                    return;
                }

                console.log("Privy token:", privyToken);

                // Call backend API để đổi Privy token lấy backend token
                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/login`,
                    {
                        method: "POST",
                        headers: {
                            accept: "application/json",
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            token: privyToken,
                        }),
                    }
                );

                if (!response.ok) {
                    const errorData = await response.text();
                    console.error("Backend login failed:", response.status, errorData);
                    return;
                }

                const data = await response.json();
                console.log("Backend login response:", data);

                // Lưu token từ backend vào localStorage
                if (data.accessToken) {
                    auth.setTokens(data.accessToken, data.refreshToken);
                    console.log("Backend tokens saved successfully");
                } else {
                    console.error("No accessToken in backend response");
                }
            } catch (error) {
                console.error("Error in login complete handler:", error);
            }
        },
        onError: (error) => {
            console.error("Login error:", error);
        },
    });

    useEffect(() => {
        console.log("ConnectButton Debug:", { authenticated, user });
    }, [authenticated, user]);

    const handleClick = async() => {
        if (onClick) {
            onClick();
        }
        if (!authenticated) {
            login();
        }
    };

    const formatAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
    };

    const userAddress = user?.wallet?.address;

    if (authenticated && userAddress) {
        return (
            <button
                onClick={handleClick}
                className={`flex items-center space-x-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors ${className}`}
            >
                <Wallet size={18} />
                <span className="text-sm">{formatAddress(userAddress)}</span>
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            className={`px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors ${className}`}
        >
            Connect Wallet
        </button>
    );
};

export default ConnectButton;
