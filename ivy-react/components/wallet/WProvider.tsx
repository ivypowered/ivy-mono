"use client";

import {
    PropsWithChildren,
    useCallback,
    useContext,
    createContext,
    useMemo,
    useEffect,
    useState,
} from "react";
import { WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletAdapter, WalletName } from "@solana/wallet-adapter-base";
import {
    CoinbaseWalletAdapter,
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { KeypairWalletAdapter } from "@/lib/KeypairWalletAdapter";

interface WContextValue {
    wallets: WalletAdapter[];
    connect: (walletName: string) => void;
    publicKey: ReturnType<typeof useWallet>["publicKey"];
    connected: ReturnType<typeof useWallet>["connected"];
    connecting: ReturnType<typeof useWallet>["connecting"];
    disconnect: ReturnType<typeof useWallet>["disconnect"];
    signTransaction: ReturnType<typeof useWallet>["signTransaction"];
    signMessage: ReturnType<typeof useWallet>["signMessage"];
    isModalOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
}

const WContext = createContext<WContextValue | null>(null);

interface WProviderProps extends PropsWithChildren {
    autoConnect: boolean;
    initialIsOpen?: boolean;
}

interface WInnerProviderProps extends PropsWithChildren {
    autoConnect: boolean;
    wallets: WalletAdapter[];
    initialIsOpen: boolean;
}

function WInnerProvider({
    autoConnect,
    children,
    wallets,
    initialIsOpen,
}: WInnerProviderProps) {
    const wctx = useWallet();

    // If we're not using `autoConnect`, we have to call `connect` ourselves
    // when it becomes available
    const [nonAutoConnectAttempt, setNonAutoConnectAttempt] = useState(false);
    useEffect(() => {
        if (
            nonAutoConnectAttempt &&
            !autoConnect &&
            wctx?.wallet?.adapter.name
        ) {
            try {
                wctx.connect();
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_e) {}
            setNonAutoConnectAttempt(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nonAutoConnectAttempt, wctx?.wallet?.adapter.name]);
    const connect = useCallback(
        (walletName: string) => {
            try {
                wctx.select(walletName as WalletName);
                setNonAutoConnectAttempt(true);
            } catch (error) {
                console.error("Failed to select wallet:", error);
            }
        },
        [wctx],
    );
    const [isModalOpen, setIsModalOpen] = useState<boolean>(initialIsOpen);

    const contextValue = useMemo<WContextValue>(
        () => ({
            wallets,
            connect,
            publicKey: wctx.publicKey,
            connected: wctx.connected,
            connecting: wctx.connecting,
            disconnect: wctx.disconnect,
            wallet: wctx.wallet,
            signTransaction: wctx.signTransaction,
            signMessage: wctx.signMessage,
            isModalOpen,
            openModal: () => setIsModalOpen(true),
            closeModal: () => setIsModalOpen(false),
        }),
        [
            wallets,
            connect,
            wctx.publicKey,
            wctx.connected,
            wctx.connecting,
            wctx.disconnect,
            wctx.wallet,
            wctx.signTransaction,
            wctx.signMessage,
            isModalOpen,
            setIsModalOpen,
        ],
    );

    return (
        <WContext.Provider value={contextValue}>{children}</WContext.Provider>
    );
}

export const KEYPAIR_WALLET_ADAPTER = new KeypairWalletAdapter();

export function WProvider({
    autoConnect,
    children,
    initialIsOpen,
}: WProviderProps) {
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new CoinbaseWalletAdapter(),
            new TorusWalletAdapter(),
            KEYPAIR_WALLET_ADAPTER,
        ],
        [],
    );
    return (
        <WalletProvider wallets={wallets} autoConnect={autoConnect}>
            <WInnerProvider
                wallets={wallets}
                autoConnect={autoConnect}
                initialIsOpen={!!initialIsOpen}
            >
                {children}
            </WInnerProvider>
        </WalletProvider>
    );
}

export function useWContext() {
    const context = useContext(WContext);
    if (!context) {
        throw new Error(
            "useSimpleWallet must be used within SimpleWalletProvider",
        );
    }
    return context;
}
