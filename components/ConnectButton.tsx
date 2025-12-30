"use client";

import { usePrivy, useLogin, useLogout } from "@privy-io/react-auth";
import { Wallet, LogOut, DollarSign, ChevronDown, ArrowDownToLine } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useAtomValue } from "jotai";
import { balancesAtom } from "@/store/trading";
import { auth } from "@/lib/api";
import DepositModal from "@/components/depositModal";

interface ConnectButtonProps {
    className?: string;
    onClick?: () => void;
    onLoginSuccess?: () => void | Promise<void>;
}

const ConnectButton = ({ className = "", onClick, onLoginSuccess }: ConnectButtonProps) => {
    const { authenticated, user, getAccessToken } = usePrivy();
    const { logout } = useLogout();
    const balances = useAtomValue(balancesAtom);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

                // Lưu token từ backend vào cookies
                // API trả về: { access_token: "...", user: {...} }
                if (data.access_token) {
                    await auth.setTokens(data.access_token, data.refresh_token);
                    console.log("Backend tokens saved successfully to cookies");

                    // ✅ Kiểm tra wallet_address trước khi gọi onLoginSuccess
                    // Chỉ gọi hdlInitWalletClientSide nếu user chưa có wallet_address
                    const hasWalletAddress = data.user?.wallet_address;

                    if (hasWalletAddress) {
                        console.log("✅ User already has wallet_address:", data.user.wallet_address);
                        console.log("⏭️ Skipping wallet initialization (already initialized)");
                    } else {
                        console.log("⚠️ User does not have wallet_address yet");
                        console.log("🚀 Calling onLoginSuccess to initialize wallet...");

                        if (onLoginSuccess) {
                            await onLoginSuccess();
                        }
                    }
                } else {
                    console.error("No access_token in backend response");
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

    // Close dropdown when click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen]);

    const handleClick = async() => {
        if (onClick) {
            onClick();
        }
        if (!authenticated) {
            login();
        } else {
            // Toggle dropdown khi đã authenticated
            setIsDropdownOpen(!isDropdownOpen);
        }
    };

    const handleLogout = async () => {
        try {
            await auth.clearTokens();
            logout();
            setIsDropdownOpen(false);
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const formatAddress = (addr: string) => {
        if (!addr) return "";
        return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
    };

    const formatBalance = (balance: number) => {
        return balance.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 6,
        });
    };

    const userAddress = user?.wallet?.address;

    // Calculate total portfolio value
    const totalValue = balances.reduce((sum, b) => sum + b.usdValue, 0);

    if (authenticated && userAddress) {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    onClick={handleClick}
                    className={`flex items-center space-x-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors ${className}`}
                >
                    <Wallet size={18} />
                    <span className="text-sm">{formatAddress(userAddress)}</span>
                    <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                        {/* Balance Section */}
                        <div className="p-4 border-b border-gray-700">
                            <div className="flex items-center space-x-2 text-gray-400 text-xs mb-2">
                                <DollarSign size={14} />
                                <span>Portfolio Balance</span>
                            </div>
                            <div className="text-white text-2xl font-bold mb-3">
                                ${formatBalance(totalValue)}
                            </div>

                            {/* Token Balances */}
                            <div className="space-y-2 mb-4">
                                {balances.map((balance, index) => (
                                    balance.balance > 0 && (
                                        <div key={index} className="flex justify-between items-center text-sm">
                                            <span className="text-gray-400">{balance.token}</span>
                                            <div className="text-right">
                                                <div className="text-white font-medium">
                                                    {formatBalance(balance.balance)}
                                                </div>
                                                <div className="text-gray-500 text-xs">
                                                    ${formatBalance(balance.usdValue)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ))}
                                {balances.length === 0 && (
                                    <div className="text-gray-500 text-sm text-center py-2">
                                        No balances yet
                                    </div>
                                )}
                            </div>

                            {/* Deposit Button */}
                            <button
                                onClick={() => {
                                    setIsDepositModalOpen(true);
                                    setIsDropdownOpen(false);
                                }}
                                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
                            >
                                <ArrowDownToLine size={16} />
                                <span>Deposit</span>
                            </button>
                        </div>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="w-full px-4 py-3 flex items-center space-x-2 text-red-400 hover:bg-gray-800 transition-colors"
                        >
                            <LogOut size={16} />
                            <span className="text-sm font-medium">Logout</span>
                        </button>
                    </div>
                )}

                {/* Deposit Modal */}
                <DepositModal
                    isOpen={isDepositModalOpen}
                    onClose={() => setIsDepositModalOpen(false)}
                />
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleClick}
                className={`px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-colors ${className}`}
            >
                Connect Wallet
            </button>

            {/* Deposit Modal */}
            <DepositModal
                isOpen={isDepositModalOpen}
                onClose={() => setIsDepositModalOpen(false)}
            />
        </>
    );
};

export default ConnectButton;
