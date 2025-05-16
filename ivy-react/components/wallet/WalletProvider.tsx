"use client";

import React, { useMemo, ReactNode, createContext, useContext } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
    UnifiedWalletProvider,
    useUnifiedWallet,
    useUnifiedWalletContext,
} from "@jup-ag/wallet-adapter";
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    CoinbaseWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { ConnectionProvider } from "@solana/wallet-adapter-react";

// Define the wallet context interface
interface WalletContextType {
    connected: boolean;
    publicKey: PublicKey | null;
    connecting: boolean;
    disconnecting: boolean;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    signTransaction:
        | ((
              transaction: Transaction | VersionedTransaction,
          ) => Promise<Transaction | VersionedTransaction>)
        | undefined;
    signMessage: ((m: Uint8Array) => Promise<Uint8Array>) | undefined;
    setShowModal: (show: boolean) => void;
}

// Create the wallet context
const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Custom hook to use the wallet context
export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return context;
}

// Wallet provider props
interface WalletProviderProps {
    children: ReactNode;
    endpoint?: string;
    autoConnect?: boolean;
}

// Wallet provider component
export function WalletProvider({
    children,
    endpoint = "https://api.mainnet-beta.solana.com",
    autoConnect = true,
}: WalletProviderProps) {
    const wallets = useMemo(
        () => [
            new CoinbaseWalletAdapter(),
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
        ],
        [],
    );

    return (
        <ConnectionProvider
            endpoint={endpoint}
            config={{ commitment: "confirmed" }}
        >
            <style>
                {`
                dialog {
                    margin: 0;
                    min-height: 100%;
                    min-width: 100%;
                }
                a[href="https://station.jup.ag/partners?category=Wallets"] {
                    display: none;
                }
                `}
            </style>
            <UnifiedWalletProvider
                wallets={wallets}
                config={{
                    autoConnect,
                    env: "mainnet-beta",
                    metadata: {
                        name: "",
                        description: "",
                        url: "",
                        iconUrls: [],
                    },
                    theme: "dark",
                }}
            >
                <WalletContextInner>{children}</WalletContextInner>
            </UnifiedWalletProvider>
        </ConnectionProvider>
    );
}

// Inner component to access unified wallet
function WalletContextInner({ children }: { children: ReactNode }) {
    const wallet = useUnifiedWallet();
    const { setShowModal } = useUnifiedWalletContext();

    const value = useMemo(() => {
        return {
            connected: wallet.connected,
            publicKey: wallet.publicKey,
            connecting: wallet.connecting,
            disconnecting: wallet.disconnecting,
            connect: wallet.connect,
            disconnect: wallet.disconnect,
            signTransaction: wallet.signTransaction,
            signMessage: wallet.signMessage,
            setShowModal,
        };
    }, [wallet, setShowModal]);

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    );
}
