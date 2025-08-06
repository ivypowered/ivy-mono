import React, { useRef } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { GameDisplay } from "@/components/game-display/GameDisplay";
import { createIvyGame, GameObject, IvyInfo } from "@/lib/game";
import { TxWidget } from "@/components/TxWidget";
import { WalletButton } from "@/components/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Keypair } from "@solana/web3.js";

const TOKEN_ID = "ivy-token";
const GAME_ID = "ivy-game";
const BUTTON_ID = "tx-button";
const WALLET_ID = "wallet-button";
const WALLET_MOBILE_ID = "wallet-mobile-button";

interface RootProps {
    tokenElement: HTMLElement | null;
    gameElement: HTMLElement | null;
    buttonElement: HTMLElement | null;
    walletElement: HTMLElement | null;
    walletMobileElement: HTMLElement | null;
    gameData?: GameObject;
    ivyInfo?: IvyInfo;
}

function Root({
    tokenElement,
    gameElement,
    buttonElement,
    walletElement,
    walletMobileElement,
    gameData,
    ivyInfo,
}: RootProps) {
    const hasMounted = useRef(false);
    if (!hasMounted.current) {
        // Remove skeletons
        if (tokenElement) {
            tokenElement.innerHTML = "";
        }
        if (gameElement) {
            gameElement.innerHTML = "";
        }
        if (buttonElement) {
            buttonElement.innerHTML = "";
        }
        if (walletElement) {
            walletElement.innerHTML = "";
        }
        if (walletMobileElement) {
            walletMobileElement.innerHTML = "";
        }

        hasMounted.current = true;
    }

    return (
        <WalletProvider>
            {gameElement &&
                gameData &&
                createPortal(
                    <GameDisplay game={gameData} showComments={true} />,
                    gameElement,
                )}

            {tokenElement &&
                ivyInfo &&
                createPortal(
                    <GameDisplay
                        game={createIvyGame(ivyInfo)}
                        showComments={false}
                    />,
                    tokenElement,
                )}

            {buttonElement && <TxWidget button_id={BUTTON_ID} />}

            {walletElement &&
                createPortal(<WalletButton mobile={false} />, walletElement)}

            {walletMobileElement &&
                createPortal(
                    <WalletButton mobile={true} />,
                    walletMobileElement,
                )}
        </WalletProvider>
    );
}

const render = () => {
    // Attach keygen to window
    (
        window as {
            keygen?: () => {
                public: string;
                private: string;
            };
        }
    ).keygen = () => {
        const k = Keypair.generate();
        return {
            public: k.publicKey.toBase58(),
            private: Buffer.from(k.secretKey).toString("hex"),
        };
    };

    // Get DOM elements
    const tokenElement = document.getElementById(TOKEN_ID);
    const gameElement = document.getElementById(GAME_ID);
    const buttonElement = document.getElementById(BUTTON_ID);
    const walletElement = document.getElementById(WALLET_ID);
    const walletMobileElement = document.getElementById(WALLET_MOBILE_ID);

    // Return early if no elements are found
    if (
        !tokenElement &&
        !gameElement &&
        !buttonElement &&
        !walletElement &&
        !walletMobileElement
    ) {
        return;
    }

    // Parse game data if available
    let gameData: GameObject | undefined;
    if (gameElement) {
        const gameBase64 = gameElement?.dataset.game;
        if (!gameBase64) {
            throw new Error("Can't find game in dataset");
        }
        try {
            gameData = JSON.parse(
                Buffer.from(gameBase64, "base64").toString("utf-8"),
            );
        } catch (e) {
            throw new Error(`Failed to parse game data: ${e}`);
        }
    }

    // Parse IVY info if available
    let ivyInfo: IvyInfo | undefined;
    if (tokenElement) {
        const infoBase64 = tokenElement?.dataset.info;
        if (!infoBase64) {
            throw new Error("No IVY info found");
        }
        try {
            ivyInfo = JSON.parse(
                Buffer.from(infoBase64, "base64").toString("utf-8"),
            ) as IvyInfo;
        } catch (e) {
            throw new Error(`Failed to parse IVY info: ${e}`);
        }
    }

    // Create a single root for the entire application
    const rootElement = document.createElement("div");
    rootElement.id = "ivy-react-root";
    document.body.appendChild(rootElement);

    const root = createRoot(rootElement);
    root.render(
        <Root
            tokenElement={tokenElement}
            gameElement={gameElement}
            buttonElement={buttonElement}
            walletElement={walletElement}
            walletMobileElement={walletMobileElement}
            gameData={gameData}
            ivyInfo={ivyInfo}
        />,
    );
};

if (document.readyState === "loading") {
    // Wait for the DOM to be fully loaded before accessing elements
    document.addEventListener("DOMContentLoaded", render);
} else {
    // DOM is already loaded :)
    render();
}
