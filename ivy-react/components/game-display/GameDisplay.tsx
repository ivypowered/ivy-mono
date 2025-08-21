"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { SwapProvider } from "@/components/swap/SwapProvider";
import { ChartInterval, ChartTab } from "@/components/chart/chartTypes";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { GameObject } from "@/lib/game";
import ReactMarkdown from "react-markdown";
import { TRANSPARENT_1X1, COMMON_TOKENS, SOL_TOKEN } from "@/lib/constants";
import { ChartHeader } from "../chart/ChartHeader";
import { GFrame } from "./GFrame";
import { PublicKey } from "@solana/web3.js";
import {
    fetchWebMetadata,
    Game,
    GAME_DECIMALS,
    WebMetadata,
} from "@/import/ivy-sdk";
import { infinitely } from "@/lib/utils";
import { ChartBase } from "../chart/ChartBase";
import { useTokens } from "@/lib/hooks";
import { TreasuryManager } from "./TreasuryManager";
import { Comments } from "./Comments";
import { useWallet } from "../wallet/WalletProvider";
import { useGameStream } from "@/lib/useGameStream";
import { QuoteContext } from "@/components/swap/QuoteProvider";
import Decimal from "decimal.js-light";
import { fetchBalance, fromRaw } from "./util";

// Main game display content
export function GameDisplay({ game }: { game: GameObject }) {
    const { publicKey, signTransaction, signMessage, openModal } = useWallet();
    const tokens = useTokens();
    const [metadata, setMetadata] = useState<WebMetadata | undefined>(
        undefined,
    );
    const [chartInterval, setChartInterval] = useState<ChartInterval>(() => {
        const age =
            Math.floor(new Date().getTime() / 1000) - game.create_timestamp;
        const chartWidth = 96; // assuming we're showing 96 candles
        if (age < chartWidth * 60) {
            // 1m chart will show full history
            return "1m";
        }
        if (age < chartWidth * (60 * 5)) {
            // 5m chart will show full history
            return "5m";
        }
        // show 15m otherwise
        return "15m";
    });
    const [activeTab, setActiveTab] = useState<ChartTab>(
        game.game_url ? "Game" : "Chart",
    );

    // Use the new stream hook
    const { data: streamData, loading: isStreamLoading } = useGameStream(
        game.address,
        chartInterval,
    );

    useEffect(() => {
        let active = true;
        infinitely(
            /* f */ () => fetchWebMetadata(game.metadata_url),
            /* desc */ "fetch game metadata",
            /* continue_ */ () => active,
        ).then((m) => setMetadata(m));
        return () => {
            active = false;
        };
    }, [game.metadata_url]);

    const gameToken = useMemo(() => {
        return {
            name: game.name,
            symbol: game.symbol,
            icon: metadata?.image || TRANSPARENT_1X1,
            decimals: GAME_DECIMALS,
            mint: Game.deriveMint(new PublicKey(game.address)).toBase58(),
        };
    }, [game, metadata]);

    // Create quote context with stream data
    const quoteContext: QuoteContext = useMemo(
        () => ({
            game: new PublicKey(game.address),
            gameSwapAlt: new PublicKey(game.swap_alt),
            gameMint: gameToken.mint,
            gameReserves: streamData
                ? {
                      ivyBalance: fromRaw(streamData.ivyBalance),
                      gameBalance: fromRaw(streamData.gameBalance),
                  }
                : null,
            worldReserves: streamData
                ? {
                      ivySold: fromRaw(streamData.ivySold),
                      ivyCurveMax: fromRaw(streamData.ivyCurveMax),
                      curveInputScale: new Decimal(streamData.curveInputScale),
                  }
                : null,
            feeConfig: streamData
                ? {
                      ivyFeeBps: streamData.ivyFeeBps,
                      gameFeeBps: streamData.gameFeeBps,
                  }
                : null,
            isSync: false,
        }),
        [game, gameToken.mint, streamData],
    );

    // Calculate price data from stream
    const priceUsd = useMemo(() => {
        if (streamData?.candles && streamData.candles.length > 0) {
            return streamData.candles[streamData.candles.length - 1].close;
        }
        return game.last_price_usd;
    }, [streamData?.candles, game.last_price_usd]);

    const changePercentUsd = streamData?.changePct24h || game.change_pct_24h;
    const marketCap = streamData?.mktCapUsd || game.mkt_cap_usd;

    // Created at from game timestamp
    const createdAt = useMemo(() => {
        if (!game.create_timestamp) {
            return undefined;
        }
        return new Date(game.create_timestamp * 1000);
    }, [game.create_timestamp]);

    const editHref = useMemo(() => {
        if (!publicKey || game.owner !== publicKey.toBase58()) {
            return "";
        }
        return "/edit?address=" + game.address;
    }, [game, publicKey]);

    // Refs for balance management
    const reloadBalancesRef = useRef<(() => void) | null>(null);
    const updateBalanceRef = useRef<
        ((mint: string, amount: Decimal) => void) | null
    >(null);

    return (
        <div className="w-full flex flex-col items-center py-8">
            <div className="w-full max-w-[1080px] px-4">
                <SwapProvider
                    connectWallet={openModal}
                    commonTokens={COMMON_TOKENS}
                    fetchBalance={fetchBalance}
                    quoteContext={quoteContext}
                    reloadBalances={reloadBalancesRef.current || (() => {})}
                    signTransaction={
                        signTransaction ||
                        (() => {
                            throw new Error(
                                "can't sign transaction: signTransaction not found",
                            );
                        })
                    }
                    tokens={tokens}
                    initialInputToken={SOL_TOKEN}
                    initialOutputToken={gameToken}
                    user={publicKey || undefined}
                    updateBalanceRef={updateBalanceRef}
                >
                    <div className="grid w-full grid-cols-1 lg:grid-cols-10 gap-4">
                        <div className="relative flex w-full flex-col gap-y-4 overflow-hidden border-4 border-emerald-400 lg:col-span-6 lg:self-start">
                            <div className="relative flex-1 overflow-hidden w-full h-full min-w-0">
                                <div
                                    className="flex flex-col w-full h-full bg-zinc-900"
                                    style={{ minWidth: 0 }}
                                >
                                    <ChartHeader
                                        token={gameToken}
                                        priceUsd={priceUsd}
                                        changePercentUsd={changePercentUsd}
                                        marketCap={marketCap}
                                        createdAt={createdAt}
                                        interval={chartInterval}
                                        setInterval={setChartInterval}
                                        activeTab={activeTab}
                                        setActiveTab={setActiveTab}
                                        withPlayButton={!!game.game_url}
                                        editHref={editHref}
                                    />

                                    <div className="flex-1 min-h-[400px] relative">
                                        {/* GFrame component handles all iframe functionality */}
                                        <GFrame
                                            game={game}
                                            publicKey={publicKey}
                                            signMessage={signMessage}
                                            openModal={openModal}
                                            reloadBalancesRef={
                                                reloadBalancesRef
                                            }
                                            updateBalanceRef={updateBalanceRef}
                                            activeTab={activeTab}
                                            minHeight={400}
                                        />

                                        {/* Show the chart when Chart tab is active */}
                                        {activeTab === "Chart" && (
                                            <ChartBase
                                                data={streamData?.candles || []}
                                                height={400}
                                                isLoading={isStreamLoading}
                                                interval={chartInterval}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <SwapWidget>
                            {/* Show Treasury Management for game owners */}
                            {publicKey &&
                                game.owner === publicKey.toBase58() && (
                                    <div className="mt-4">
                                        <TreasuryManager
                                            game={game}
                                            userAddress={publicKey.toBase58()}
                                            reloadBalancesRef={
                                                reloadBalancesRef
                                            }
                                            signTransaction={
                                                signTransaction ||
                                                (() => {
                                                    throw new Error(
                                                        "can't sign tx",
                                                    );
                                                })
                                            }
                                            updateBalance={
                                                updateBalanceRef.current ||
                                                (() => {
                                                    throw new Error(
                                                        "can't update balance",
                                                    );
                                                })
                                            }
                                        />
                                    </div>
                                )}
                        </SwapWidget>
                    </div>
                </SwapProvider>

                {/* Game Description in Markdown with Hollow Tab */}
                {metadata?.description && (
                    <div className="mt-8 relative">
                        {/* Hollow Description Tab */}
                        <div className="absolute -top-3 left-4 bg-zinc-900 px-3 py-1 text-emerald-400 font-bold border-4 border-emerald-400 text-sm">
                            Description
                        </div>
                        {/* Description Content */}
                        <div className="border-4 border-emerald-400 p-4 pt-8 bg-zinc-900 markdown">
                            <ReactMarkdown>
                                {metadata?.description}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}

                {/* Comments Section */}
                <div className="mt-8 space-y-4">
                    {/* Comments Display */}
                    <Comments
                        gameAddress={game.address}
                        userAddress={publicKey?.toBase58()}
                        onConnectWallet={() => openModal()}
                        signTransaction={
                            signTransaction ||
                            (() => {
                                throw new Error("can't find signTransaction");
                            })
                        }
                        comments={streamData?.comments}
                        totalComments={streamData?.comments.length || 0}
                    />
                </div>
            </div>
        </div>
    );
}
