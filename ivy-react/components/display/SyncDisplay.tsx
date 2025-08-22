"use client";

import { useState, useMemo, useRef } from "react";
import { SwapProvider } from "@/components/swap/SwapProvider";
import { ChartInterval, ChartTab } from "@/components/chart/chartTypes";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { SwapToken } from "@/components/swap/swapTypes";
import { COMMON_TOKENS, SOL_TOKEN, TRANSPARENT_1X1 } from "@/lib/constants";
import { ChartHeader } from "../chart/ChartHeader";
import { PublicKey } from "@solana/web3.js";
import { ChartBase } from "../chart/ChartBase";
import { useTokens } from "@/lib/hooks";
import { useWallet } from "../wallet/WalletProvider";
import { useSyncStream } from "@/lib/useSyncStream";
import { QuoteContext } from "@/components/swap/QuoteProvider";
import Decimal from "decimal.js-light";
import { fetchBalance } from "./util";
import { Sync, SYNC_DECIMALS } from "@/import/ivy-sdk";
import { Frame } from "../frame";
import { Description } from "./Description";
import { Comments } from "./Comments"; // Added import

export interface SyncInfo {
    address: string;
    name: string;
    symbol: string;
    icon_url: string;
    description: string;
    create_timestamp: number;
    game_url: string;
    external_mint: string;
    decimals: number;
    last_price_usd: number;
    mkt_cap_usd: number;
    change_pct_24h: number;
}

// Sync display component for pump.fun tokens
export function SyncDisplay({ syncInfo }: { syncInfo: SyncInfo }) {
    const { publicKey, signTransaction, openModal } = useWallet();
    const tokens = useTokens();
    const [chartInterval, setChartInterval] = useState<ChartInterval>(() => {
        const age =
            Math.floor(new Date().getTime() / 1000) - syncInfo.create_timestamp;
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
        syncInfo.game_url ? "Game" : "Chart",
    );

    // Use the sync stream hook
    const { data: streamData, loading: isStreamLoading } = useSyncStream(
        syncInfo.address,
        chartInterval,
    );

    // Create the sync token object
    const syncToken = useMemo<SwapToken>(() => {
        return {
            name: syncInfo.name,
            symbol: syncInfo.symbol,
            icon: syncInfo.icon_url || TRANSPARENT_1X1,
            decimals: SYNC_DECIMALS,
            mint: Sync.deriveMint(new PublicKey(syncInfo.address)).toBase58(),
        };
    }, [syncInfo]);

    // Create quote context for sync tokens
    const quoteContext: QuoteContext = useMemo(() => {
        return {
            syncInfo: streamData
                ? {
                      solReserves: streamData.solReserves,
                      tokenReserves: streamData.tokenReserves,
                      isMigrated: streamData.isMigrated,
                      pswapPool: streamData.pswapPool,
                      solPrice: streamData.solPrice,
                  }
                : null,
            tokenMint: new PublicKey(syncToken.mint),
            isSync: true,
            pumpMint: new PublicKey(syncInfo.external_mint),
            syncAddress: new PublicKey(syncInfo.address),
        };
    }, [streamData, syncInfo.external_mint, syncToken.mint, syncInfo.address]);

    // Calculate price data from stream
    const priceUsd = useMemo(() => {
        if (streamData?.candles && streamData.candles.length > 0) {
            return streamData.candles[streamData.candles.length - 1].close;
        }
        return syncInfo.last_price_usd;
    }, [streamData?.candles, syncInfo.last_price_usd]);

    const changePercentUsd =
        streamData?.changePct24h || syncInfo.change_pct_24h;
    const marketCap = streamData?.mktCapUsd || syncInfo.mkt_cap_usd;

    // Created at from sync timestamp
    const createdAt = useMemo(() => {
        if (!syncInfo.create_timestamp) {
            return undefined;
        }
        return new Date(syncInfo.create_timestamp * 1000);
    }, [syncInfo.create_timestamp]);

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
                    initialOutputToken={syncToken}
                    isInputFixed={true}
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
                                        token={syncToken}
                                        priceUsd={priceUsd}
                                        changePercentUsd={changePercentUsd}
                                        marketCap={marketCap}
                                        createdAt={createdAt}
                                        interval={chartInterval}
                                        setInterval={setChartInterval}
                                        activeTab={activeTab}
                                        setActiveTab={setActiveTab}
                                        withPlayButton={!!syncInfo.game_url}
                                        editHref=""
                                        isSync={true}
                                    />

                                    <div className="flex-1 min-h-[400px] relative">
                                        <Frame
                                            src={syncInfo.game_url}
                                            title={syncInfo.name}
                                            className={`w-full h-full ${activeTab === "Game" ? "" : "hidden"}`}
                                            minHeight={400}
                                            showFullscreenButton={true}
                                            setFrameWindow={() => {}}
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

                        <SwapWidget></SwapWidget>
                    </div>
                </SwapProvider>

                {/* Description */}
                <Description
                    className="mt-8"
                    description={syncInfo.description}
                />

                {/* Comments Section */}
                <Comments
                    gameAddress={syncInfo.address}
                    userAddress={publicKey?.toBase58()}
                    onConnectWallet={() => openModal()}
                    signTransaction={
                        signTransaction ||
                        (() => {
                            throw new Error("can't find signTransaction");
                        })
                    }
                    comments={streamData?.comments}
                    totalComments={streamData?.comments?.length || 0}
                    className="mt-8"
                />
            </div>
        </div>
    );
}
