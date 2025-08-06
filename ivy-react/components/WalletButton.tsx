"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
    LinkIcon,
    WalletIcon,
    ExternalLink,
    LogOut,
    Copy,
    Check,
} from "lucide-react";
import { useWallet } from "./wallet/WalletProvider";

export function WalletButton({ mobile }: { mobile: boolean }) {
    const { connected, publicKey, disconnect, openModal } = useWallet();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Format public key for display
    const formattedAddress = useMemo(() => {
        if (!publicKey) return "";
        const address = publicKey.toBase58();
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }, [publicKey]);

    // Function to connect wallet
    const connectWallet = () => {
        openModal();
    };

    // Function to disconnect wallet
    const disconnectWallet = () => {
        disconnect();
        setIsDropdownOpen(false);
    };

    // Function to view address on Solscan
    const viewOnExplorer = () => {
        if (publicKey) {
            window.open(
                `https://solscan.io/account/${publicKey.toBase58()}`,
                "_blank",
            );
            setIsDropdownOpen(false);
        }
    };

    // Function to copy address to clipboard
    const copyAddress = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey.toBase58());
            setHasCopied(true);

            // Reset copy state after 1 second
            setTimeout(() => {
                setHasCopied(false);
            }, 1000);
        }
    };

    // Handle click outside to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            {connected && publicKey ? (
                <>
                    <button
                        className="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 flex items-center justify-center"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                        <WalletIcon
                            className={mobile ? "h-6 w-6" : "h-5 w-5"}
                        />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-zinc-900 border-2 border-emerald-400 z-10">
                            {/* Header */}
                            <div className="font-bold text-emerald-400 border-b-2 border-emerald-400 px-4 py-2">
                                Wallet
                            </div>

                            {/* Address - Now the entire div is clickable */}
                            <div
                                className="flex items-center justify-between px-4 py-2 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 cursor-pointer"
                                onClick={copyAddress}
                            >
                                <span>{formattedAddress}</span>
                                {hasCopied ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </div>

                            {/* Separator */}
                            <div className="h-[2px] bg-emerald-400"></div>

                            {/* View on Solana Explorer */}
                            <button
                                className="w-full text-left px-4 py-2 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 flex items-center"
                                onClick={viewOnExplorer}
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                <span>View on Solscan</span>
                            </button>

                            {/* Disconnect */}
                            <button
                                className="w-full text-left px-4 py-2 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 flex items-center"
                                onClick={disconnectWallet}
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Disconnect</span>
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <button
                    className="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 flex items-center justify-center"
                    onClick={connectWallet}
                >
                    <LinkIcon className={mobile ? "h-6 w-6" : "h-5 w-5"} />
                </button>
            )}
        </div>
    );
}
