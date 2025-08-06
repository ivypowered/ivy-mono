"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ArrowLeft } from "lucide-react";
import { useWContext } from "./WProvider";
import { WalletAdapter, WalletReadyState } from "@solana/wallet-adapter-base";

interface WModalProps {
    accentColor: "emerald" | "sky";
    logoSrc: string;
}

// Wallet connection state
interface WalletConnectionState {
    installDialog: WalletAdapter | null;
}

// Color mapping for dynamic accent colors
const colorMap = {
    emerald: {
        border: "border-emerald-400",
        text: "text-emerald-400",
        hover: "hover:text-emerald-300",
        focus: "focus:border-emerald-300",
        borderT: "border-t-transparent",
    },
    sky: {
        border: "border-sky-400",
        text: "text-sky-400",
        hover: "hover:text-sky-300",
        focus: "focus:border-sky-300",
        borderT: "border-t-transparent",
    },
};

export function WModal({ accentColor, logoSrc }: WModalProps) {
    // Get color classes based on accent color
    const colors = colorMap[accentColor];

    // Wallet connection state
    const [walletConnection, setWalletConnection] =
        useState<WalletConnectionState>({
            installDialog: null,
        });

    // Shared error state
    const [error, setError] = useState<string | null>(null);

    // Context and hooks
    const { wallets, connect, connecting, connected, isModalOpen, closeModal } =
        useWContext();

    // If connected, close
    useEffect(() => {
        if (connected && isModalOpen) {
            closeModal();
        }
    }, [connected, isModalOpen, closeModal]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isModalOpen) {
            setWalletConnection({ installDialog: null });
            setError(null);
        }
    }, [isModalOpen]);

    if (!isModalOpen) return null;

    // Wallet connection handlers
    const handleWalletConnect = (wallet: WalletAdapter) => {
        if (wallet.readyState === WalletReadyState.NotDetected) {
            setWalletConnection({ installDialog: wallet });
            return;
        }
        try {
            connect(wallet.name);
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            setError("Failed to connect wallet. Please try again.");
        }
    };

    // Check if we should disable close button
    const isCloseDisabled = connecting;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="relative w-full max-w-md">
                <div className={`border-4 ${colors.border} bg-zinc-900 p-4`}>
                    {/* Close button */}
                    <button
                        onClick={closeModal}
                        className={`absolute top-4 right-4 ${colors.text} ${colors.hover} cursor-pointer`}
                        disabled={isCloseDisabled}
                    >
                        <X size={24} />
                    </button>

                    {/* Installation Dialog */}
                    {walletConnection.installDialog ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-6">
                                {walletConnection.installDialog.icon && (
                                    <img
                                        src={
                                            walletConnection.installDialog.icon
                                        }
                                        alt={
                                            walletConnection.installDialog.name
                                        }
                                        className="h-20 w-20"
                                    />
                                )}
                            </div>

                            <h2 className="text-lg font-semibold text-white mb-4">
                                Have you installed{" "}
                                {walletConnection.installDialog.name}?
                            </h2>

                            {walletConnection.installDialog.url && (
                                <a
                                    href={walletConnection.installDialog.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 ${colors.text} ${colors.hover} mb-6`}
                                >
                                    Install{" "}
                                    {walletConnection.installDialog.name}
                                    <ExternalLink size={16} />
                                </a>
                            )}

                            <div className="text-zinc-300 text-sm text-left max-w-xs mx-auto mb-8 space-y-3">
                                <div>
                                    <p className="font-semibold text-white">
                                        On mobile:
                                    </p>
                                    <p className="pl-4">
                                        • You should open the app instead
                                    </p>
                                </div>
                                <div>
                                    <p className="font-semibold text-white">
                                        On desktop:
                                    </p>
                                    <p className="pl-4">
                                        • Install and refresh the page
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() =>
                                    setWalletConnection({ installDialog: null })
                                }
                                className={`inline-flex items-center gap-2 px-4 py-2 border-2 ${colors.border} bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer`}
                            >
                                <ArrowLeft size={16} />
                                Go back
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Main Content */}
                            <h2 className="text-lg font-semibold text-white text-center mb-6">
                                Connect a wallet
                            </h2>

                            {/* Custom Logo */}
                            <div className="flex justify-center mb-8">
                                <img
                                    src={logoSrc}
                                    alt="Logo"
                                    className="h-16 w-auto"
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            {/* Wallet Options */}
                            <div className="space-y-3">
                                {wallets.map((wallet) => (
                                    <button
                                        key={wallet.name}
                                        onClick={() =>
                                            handleWalletConnect(wallet)
                                        }
                                        disabled={
                                            connecting || !wallet.readyState
                                        }
                                        className={`w-full flex items-center gap-3 p-3 border-2 ${colors.border} bg-zinc-800
                                            ${
                                                connecting || !wallet.readyState
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : "hover:bg-zinc-700 cursor-pointer"
                                            }`}
                                    >
                                        {wallet.icon && (
                                            <img
                                                src={wallet.icon}
                                                alt={wallet.name}
                                                className="w-6 h-6"
                                            />
                                        )}
                                        <span className="text-white font-medium">
                                            {wallet.name}
                                        </span>
                                        {connecting && wallet.connecting && (
                                            <span
                                                className={`ml-auto ${colors.text} text-sm`}
                                            >
                                                Connecting...
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
