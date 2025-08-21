// ivy-react/components/game-display/GFrame.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Frame } from "../frame";
import { PublicKey } from "@solana/web3.js";
import { Api } from "@/lib/api";
import { Game, Auth, TEXT_ENCODER } from "@/import/ivy-sdk";
import { GameObject } from "@/lib/game";
import Decimal from "decimal.js-light";

interface GFrameProps {
    game: GameObject;
    publicKey: PublicKey | null;
    signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
    openModal: () => void;
    reloadBalancesRef: React.MutableRefObject<(() => void) | null>;
    updateBalanceRef: React.MutableRefObject<
        ((mint: string, amount: Decimal) => void) | null
    >;
    activeTab: string;
    className?: string;
    minHeight?: number;
}

export function GFrame({
    game,
    publicKey,
    signMessage,
    openModal,
    reloadBalancesRef,
    updateBalanceRef,
    activeTab,
    className = "",
    minHeight = 400,
}: GFrameProps) {
    // Frame URL and origin
    const [frameSrc, setFrameSrc] = useState("about:blank");
    const [frameOrigin, setFrameOrigin] = useState("about:blank");

    // Frame window and subscription state
    const [frameWindow, setFrameWindow] = useState<Window | null>(null);
    const [subscribed, setSubscribed] = useState<boolean>(false);
    const [subscribeKey, setSubscribeKey] = useState<number>(0);

    // Frame authentication state
    const [frameState, setFrameState] = useState<{
        user: string | null;
        message: string | null;
        signature: string | null;
    }>({ user: null, message: null, signature: null });

    // Rate limiting for balance reloads
    const balanceReloadRateLimit = useRef<{
        count: number;
        intervalEnd: number;
    }>({ count: 0, intervalEnd: 0 });

    // Set up frame URL
    useEffect(() => {
        let u: URL;
        try {
            u = new URL(game.game_url);
            u.searchParams.append("parentOrigin", window.origin);
            setFrameSrc(u.toString());
            setFrameOrigin(u.origin);
        } catch {
            setFrameSrc("about:blank");
            setFrameOrigin("about:blank");
        }
    }, [game.game_url]);

    // Load/update authentication state
    useEffect(() => {
        setFrameState((s) => {
            if (!publicKey) {
                return {
                    user: null,
                    message: null,
                    signature: null,
                };
            }
            if (s.user !== null && s.user === publicKey.toBase58()) {
                return s;
            }
            let message: string | null = null;
            let signature: string | null = null;
            try {
                const v = window.localStorage.getItem(
                    `ivy-auth-${game.address}-${publicKey.toBase58()}`,
                );
                if (!v) {
                    throw new Error("not found");
                }
                const vv = JSON.parse(v);
                const user = Auth.verifyMessage(
                    new PublicKey(game.address),
                    vv.message,
                    Buffer.from(vv.signature, "hex"),
                );
                if (!user.equals(publicKey)) {
                    throw new Error("saved auth details for wrong user");
                }
                message = vv.message || null;
                signature = vv.signature || null;
            } catch {}
            return {
                user: publicKey.toBase58(),
                message,
                signature,
            };
        });
    }, [publicKey, game.address]);

    // Auto-refresh auth token
    useEffect(() => {
        if (!frameState.message || !frameState.signature) {
            return;
        }
        const expiry = Auth.getMessageExpiry(frameState.message);
        const intv = setInterval(() => {
            const now = Math.floor(new Date().getTime() / 1_000);
            if (Math.abs(now - expiry) > 300) {
                // More than 5 minutes left, we still have time
                return;
            }
            // Refresh our auth token
            setFrameState((s) => ({
                user: s.user,
                message: null,
                signature: null,
            }));
        }, 60_000);
        return () => clearInterval(intv);
    }, [frameState]);

    // Send frame state to iframe when subscribed
    useEffect(() => {
        if (!subscribed || !frameWindow) {
            return;
        }
        frameWindow.postMessage(frameState, frameOrigin);
    }, [frameState, subscribed, subscribeKey, frameWindow, frameOrigin]);

    // Handle balance reload
    const handleBalanceReload = useCallback(async () => {
        // Rate limiting
        const now = Math.floor(new Date().getTime() / 1000);
        const rl = balanceReloadRateLimit.current;
        if (now > rl.intervalEnd) {
            rl.count = 0;
            rl.intervalEnd = now + 60;
        }
        rl.count++;
        if (rl.count > 15) {
            // No more than 15 balance reloads every 60 seconds
            return;
        }

        // Requires user
        if (!publicKey) {
            return;
        }

        const reloadFn = reloadBalancesRef.current;
        if (reloadFn) {
            // Use the treasury management's reload function if available
            reloadFn();
            return;
        }

        // Otherwise update swap state manually
        const updateFn = updateBalanceRef.current;
        if (!updateFn) {
            return;
        }

        const mint = Game.deriveAddresses(new PublicKey(game.address)).mint;

        try {
            const balance = await Api.getTokenBalance(publicKey, mint);
            updateFn(
                mint.toBase58(),
                new Decimal(balance).div(new Decimal(10).pow(9)),
            );
        } catch {}
    }, [publicKey, game.address, reloadBalancesRef, updateBalanceRef]);

    // Handle sign message
    const handleSignMessage = useCallback(async () => {
        if (!publicKey || !signMessage) {
            console.error(
                "Can't sign message: missing publicKey or signMessage",
            );
            return;
        }

        const message = Auth.createMessage(
            new PublicKey(game.address),
            publicKey,
        );

        try {
            const signature = Buffer.from(
                await signMessage(TEXT_ENCODER.encode(message)),
            ).toString("hex");

            window.localStorage.setItem(
                `ivy-auth-${game.address}-${publicKey.toBase58()}`,
                JSON.stringify({ message, signature }),
            );

            setFrameState((s) => {
                if (!s.user || s.user !== publicKey.toBase58()) {
                    // User has changed since we requested signature
                    return s;
                }
                return {
                    user: publicKey.toBase58(),
                    message,
                    signature,
                };
            });
        } catch (e) {
            console.error("Failed to sign message:", e);
        }
    }, [publicKey, signMessage, game.address]);

    // Handle logout
    const handleLogout = useCallback(() => {
        setFrameState((s) => {
            if (!s.user || !s.message || !s.signature) {
                // User is already logged out
                return s;
            }
            window.localStorage.removeItem(
                `ivy-auth-${game.address}-${s.user}`,
            );
            return {
                user: s.user,
                message: null,
                signature: null,
            };
        });
    }, [game.address]);

    // Message handler
    useEffect(() => {
        const onMessage = async (ev: MessageEvent) => {
            if (ev.origin !== frameOrigin) {
                return;
            }
            if (typeof ev.data !== "object") {
                return;
            }
            if (typeof ev.data.action !== "string") {
                return;
            }

            switch (ev.data.action) {
                case "subscribe":
                    setSubscribed(true);
                    setSubscribeKey((k) => k + 1);
                    break;
                case "connect_wallet":
                    openModal();
                    break;
                case "reload_balance":
                    await handleBalanceReload();
                    break;
                case "sign_message":
                    await handleSignMessage();
                    break;
                case "logout":
                    handleLogout();
                    break;
            }
        };

        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [
        frameOrigin,
        openModal,
        handleBalanceReload,
        handleSignMessage,
        handleLogout,
    ]);

    return (
        <Frame
            src={frameSrc}
            title={game.name}
            className={`w-full h-full ${activeTab === "Game" ? "" : "hidden"} ${className}`}
            minHeight={minHeight}
            showFullscreenButton={true}
            setFrameWindow={setFrameWindow}
        />
    );
}
