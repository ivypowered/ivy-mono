"use client";

import { useState, useEffect, useMemo } from "react";
import { X, ExternalLink, ArrowLeft } from "lucide-react";
import { useWContext } from "./WProvider";
import { WalletAdapter, WalletReadyState } from "@solana/wallet-adapter-base";
import { KEYPAIR_WALLET_ADAPTER } from "./WProvider";
import { Keypair } from "@solana/web3.js";

interface WModalProps {
    accentColor: "emerald" | "sky";
    logoSrc: string;
}

// Wallet connection state
interface WalletConnectionState {
    installDialog: WalletAdapter | null;
    keypairDialog: boolean;
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

    // Whether to include the Keypair wallet based on URL query param
    const [includeKeypair, setIncludeKeypair] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            setIncludeKeypair(params.get("showKeypairWallet") === "true");
        }
    }, []);

    // Wallet connection state
    const [walletConnection, setWalletConnection] =
        useState<WalletConnectionState>({
            installDialog: null,
            keypairDialog: false,
        });

    // Shared error state
    const [error, setError] = useState<string | null>(null);

    // Keypair input state
    const [secretKeyText, setSecretKeyText] = useState<string>("");
    const [validationError, setValidationError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);

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
            setWalletConnection({ installDialog: null, keypairDialog: false });
            setError(null);
            setSecretKeyText("");
            setValidationError(null);
            setSubmitError(null);
        }
    }, [isModalOpen]);

    // Only show Keypair wallet when includeKeypair=true
    const displayWallets = useMemo(
        () =>
            includeKeypair
                ? wallets
                : wallets.filter((w) => w !== KEYPAIR_WALLET_ADAPTER),
        [wallets, includeKeypair],
    );

    if (!isModalOpen) return null;

    // Validation for secret key input (basic JSON + byte array shape)
    const validateSecretKeyInput = (text: string): string | null => {
        if (!text.trim()) return "Secret key is required.";
        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed))
                return "Secret key must be a JSON array of bytes.";
            const allBytes = parsed.every(
                (n: unknown) =>
                    Number.isInteger(n) &&
                    (n as number) >= 0 &&
                    (n as number) <= 255,
            );
            if (!allBytes)
                return "Array must contain integers between 0 and 255.";
            return null;
        } catch {
            return "Invalid JSON.";
        }
    };

    const onSecretKeyChange = (v: string) => {
        setSecretKeyText(v);
        setSubmitError(null);
        setValidationError(validateSecretKeyInput(v));
    };

    // Wallet connection handlers
    const handleWalletConnect = (wallet: WalletAdapter) => {
        // Special handling for Keypair wallet
        if (wallet === KEYPAIR_WALLET_ADAPTER) {
            setWalletConnection({ installDialog: null, keypairDialog: true });
            return;
        }

        if (wallet.readyState === WalletReadyState.NotDetected) {
            setWalletConnection({
                installDialog: wallet,
                keypairDialog: false,
            });
            return;
        }
        try {
            connect(wallet.name);
        } catch (error) {
            console.error("Failed to connect wallet:", error);
            setError("Failed to connect wallet. Please try again.");
        }
    };

    const handleSubmitKeypair = () => {
        setSubmitError(null);
        try {
            const parsed = JSON.parse(secretKeyText);
            const secret = Uint8Array.from(parsed);
            // Validate by attempting to construct a Keypair
            const kp = Keypair.fromSecretKey(secret);
            // If valid, set on adapter and connect
            KEYPAIR_WALLET_ADAPTER.setKeypair(kp);
            connect(KEYPAIR_WALLET_ADAPTER.name);
        } catch (e) {
            console.error("Invalid keypair secret:", e);
            setSubmitError(
                "Invalid secret key. Please ensure it's a valid JSON-encoded secret key.",
            );
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

                    {/* Keypair Secret Input Dialog */}
                    {walletConnection.keypairDialog ? (
                        <div className="text-center">
                            <div className="flex justify-center mb-6">
                                {KEYPAIR_WALLET_ADAPTER.icon && (
                                    <img
                                        src={KEYPAIR_WALLET_ADAPTER.icon}
                                        alt={KEYPAIR_WALLET_ADAPTER.name}
                                        className="h-20 w-20"
                                    />
                                )}
                            </div>

                            <h2 className="text-lg font-semibold text-white mb-3">
                                Use a keypair
                            </h2>

                            <textarea
                                value={secretKeyText}
                                onChange={(e) =>
                                    onSecretKeyChange(e.target.value)
                                }
                                placeholder="[12,34,56, ...]"
                                className={`w-full px-3 py-2 bg-zinc-800 text-white border-2 ${colors.border} ${colors.focus} outline-none`}
                                rows={5}
                            />

                            {(validationError || submitError) && (
                                <div className="mt-3 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm text-left">
                                    {validationError || submitError}
                                </div>
                            )}

                            <div className="flex justify-center gap-3 mt-6">
                                <button
                                    onClick={() =>
                                        setWalletConnection({
                                            installDialog: null,
                                            keypairDialog: false,
                                        })
                                    }
                                    className={`inline-flex items-center gap-2 px-4 py-2 border-2 ${colors.border} bg-zinc-800 text-white hover:bg-zinc-700 cursor-pointer`}
                                    disabled={connecting}
                                >
                                    <ArrowLeft size={16} />
                                    Back
                                </button>
                                <button
                                    onClick={handleSubmitKeypair}
                                    className={`px-4 py-2 border-2 ${colors.border} bg-zinc-800 text-white ${!validationError && !connecting ? "hover:bg-zinc-700 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                                    disabled={!!validationError || connecting}
                                >
                                    {connecting
                                        ? "Connecting..."
                                        : "Use keypair"}
                                </button>
                            </div>
                        </div>
                    ) : walletConnection.installDialog ? (
                        // Installation Dialog
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
                                    setWalletConnection({
                                        installDialog: null,
                                        keypairDialog: false,
                                    })
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
                                {displayWallets.map((wallet) => (
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
