import { useWContext, WProvider } from "./WProvider";
import { WModal } from "./WModal";
import React from "react";

export function WalletProvider({ children }: { children: React.ReactNode }) {
    return (
        <WProvider autoConnect={true}>
            <WModal
                accentColor="emerald"
                logoSrc="/assets/images/ivy-icon.svg"
            />
            {children}
        </WProvider>
    );
}

export function useWallet() {
    return useWContext();
}
