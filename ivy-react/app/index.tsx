import React, { useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { GameDisplay } from "@/components/display/GameDisplay";
import { GameObject } from "@/lib/game";
import { TxWidget } from "@/components/TxWidget";
import { WalletButton } from "@/components/WalletButton";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Keypair } from "@solana/web3.js";
import { IvyInfo, WorldDisplay } from "@/components/display/WorldDisplay";
import { SyncDisplay } from "@/components/display/SyncDisplay";
import { SyncInfo } from "@/components/display/SyncDisplay";
import { TradeTicker } from "@/components/TradeTicker";
import { HotTask } from "@/components/tasks/HotTask";
import { NewTask } from "@/components/tasks/NewTask";

const TOKEN_ID = "ivy-token";
const GAME_ID = "ivy-game";
const SYNC_ID = "ivy-sync";
const BUTTON_ID = "tx-button";
const WALLET_ID = "wallet-button";
const WALLET_MOBILE_ID = "wallet-mobile-button";
const TRADE_TICKER_ID = "trade-ticker";
const GAMES_GRID_ID = "games-grid";

interface RootProps {
    tokenElement: HTMLElement | null;
    gameElement: HTMLElement | null;
    syncElement: HTMLElement | null;
    buttonElement: HTMLElement | null;
    walletElement: HTMLElement | null;
    walletMobileElement: HTMLElement | null;
    tradeTickerElement: HTMLElement | null;
    gamesGridElement: HTMLElement | null;
    gameData?: GameObject;
    ivyInfo?: IvyInfo;
    syncInfo?: SyncInfo;
}

function Root({
    tokenElement,
    gameElement,
    syncElement,
    buttonElement,
    walletElement,
    walletMobileElement,
    tradeTickerElement,
    gamesGridElement,
    gameData,
    ivyInfo,
    syncInfo,
}: RootProps) {
    const hasMounted = useRef(false);
    if (!hasMounted.current) {
        if (tokenElement) tokenElement.innerHTML = "";
        if (gameElement) gameElement.innerHTML = "";
        if (buttonElement) buttonElement.innerHTML = "";
        if (walletElement) walletElement.innerHTML = "";
        if (walletMobileElement) walletMobileElement.innerHTML = "";
        if (tradeTickerElement) tradeTickerElement.innerHTML = "";
        hasMounted.current = true;
    }

    const tab = useMemo(() => {
        const url = new URL(window.location.href);
        return (url.searchParams.get("tab") || "hot").toLowerCase();
    }, []);

    return (
        <WalletProvider>
            {gameElement &&
                gameData &&
                createPortal(<GameDisplay game={gameData} />, gameElement)}

            {tokenElement &&
                ivyInfo &&
                createPortal(<WorldDisplay ivyInfo={ivyInfo} />, tokenElement)}

            {syncElement &&
                syncInfo &&
                createPortal(<SyncDisplay syncInfo={syncInfo} />, syncElement)}

            {buttonElement && <TxWidget button_id={BUTTON_ID} />}

            {walletElement &&
                createPortal(<WalletButton mobile={false} />, walletElement)}

            {walletMobileElement &&
                createPortal(
                    <WalletButton mobile={true} />,
                    walletMobileElement,
                )}

            {/* New: trade ticker portal */}
            {tradeTickerElement &&
                createPortal(
                    <TradeTicker containerEl={tradeTickerElement} />,
                    tradeTickerElement,
                )}

            {/* New: tasks to enhance games grid based on tab */}
            {gamesGridElement && tab === "hot" && (
                <HotTask gamesGridElement={gamesGridElement} />
            )}

            {gamesGridElement && tab === "new" && (
                <NewTask gamesGridElement={gamesGridElement} />
            )}
            {/* tab === "top" => no live updates */}
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
    const syncElement = document.getElementById(SYNC_ID);
    const buttonElement = document.getElementById(BUTTON_ID);
    const walletElement = document.getElementById(WALLET_ID);
    const walletMobileElement = document.getElementById(WALLET_MOBILE_ID);

    // NEW shells
    const tradeTickerElement = document.getElementById(TRADE_TICKER_ID);
    const gamesGridElement = document.getElementById(GAMES_GRID_ID);

    // Return early if no elements are found anywhere
    if (
        !tokenElement &&
        !gameElement &&
        !syncElement &&
        !buttonElement &&
        !walletElement &&
        !walletMobileElement &&
        !tradeTickerElement &&
        !gamesGridElement
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

    // Parse sync info if available
    let syncInfo: SyncInfo | undefined;
    if (syncElement) {
        const infoBase64 = syncElement?.dataset.info;
        if (!infoBase64) {
            throw new Error("No sync info found");
        }
        try {
            syncInfo = JSON.parse(
                Buffer.from(infoBase64, "base64").toString("utf-8"),
            ) as SyncInfo;
        } catch (e) {
            throw new Error(`Failed to parse sync info: ${e}`);
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
            syncElement={syncElement}
            buttonElement={buttonElement}
            walletElement={walletElement}
            walletMobileElement={walletMobileElement}
            tradeTickerElement={tradeTickerElement}
            gamesGridElement={gamesGridElement}
            gameData={gameData}
            ivyInfo={ivyInfo}
            syncInfo={syncInfo}
        />,
    );
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
} else {
    render();
}
