"use client";

import { useState, useMemo, useRef } from "react";
import { SwapProvider } from "@/components/swap/SwapProvider";
import { ChartInterval } from "@/components/chart/chartTypes";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { COMMON_TOKENS, SOL_TOKEN, IVY_TOKEN } from "@/lib/constants";
import { ChartHeader } from "../chart/ChartHeader";
import { PublicKey } from "@solana/web3.js";
import { ChartBase } from "../chart/ChartBase";
import { useTokens } from "@/lib/hooks";
import { useWallet } from "../wallet/WalletProvider";
import { useWorldStream } from "@/lib/useWorldStream";
import { QuoteContext } from "@/components/swap/QuoteProvider";
import Decimal from "decimal.js-light";
import { fetchBalance, fromRaw } from "./util";

export interface IvyInfo {
    create_timestamp: number;
    ivy_price: number;
    ivy_mkt_cap: number;
    ivy_change_24h: number;
}

// World display component for IVY token
export function WorldDisplay({ ivyInfo }: { ivyInfo: IvyInfo }) {
    const { publicKey, signTransaction, openModal } = useWallet();
    const tokens = useTokens();
    const [chartInterval, setChartInterval] = useState<ChartInterval>("15m");

    const { data: streamData, loading: isStreamLoading } =
        useWorldStream(chartInterval);

    // Create quote context for IVY
    const quoteContext: QuoteContext = useMemo(
        () => ({
            game: PublicKey.default,
            gameSwapAlt: PublicKey.default,
            gameMint: PublicKey.default.toBase58(),
            gameReserves: null,
            worldReserves: streamData
                ? {
                      ivySold: fromRaw(streamData.ivySold || "0"),
                      ivyCurveMax: fromRaw(streamData.ivyCurveMax || "0"),
                      curveInputScale: new Decimal(
                          streamData.curveInputScale || 1,
                      ),
                  }
                : null,
            feeConfig: null,
            isSync: false,
        }),
        [streamData],
    );

    // Calculate price data from stream
    const priceUsd = useMemo(() => {
        if (streamData?.candles && streamData.candles.length > 0) {
            return streamData.candles[streamData.candles.length - 1].close;
        }
        return ivyInfo.ivy_price;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [streamData?.candles]);

    const changePercentUsd = streamData?.changePct24h || ivyInfo.ivy_change_24h;
    const marketCap = streamData?.mktCapUsd || ivyInfo.ivy_mkt_cap;

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
                    initialOutputToken={IVY_TOKEN}
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
                                        token={IVY_TOKEN}
                                        priceUsd={priceUsd}
                                        changePercentUsd={changePercentUsd}
                                        marketCap={marketCap}
                                        createdAt={
                                            new Date(
                                                ivyInfo.create_timestamp * 1000,
                                            )
                                        }
                                        interval={chartInterval}
                                        setInterval={setChartInterval}
                                        activeTab={"Chart"}
                                        setActiveTab={() => {}} // can't change it :)
                                        withPlayButton={false} // No game for IVY
                                        editHref="" // No edit option for world
                                    />

                                    <div className="flex-1 min-h-[400px] relative">
                                        {/* Only show chart, no game iframe for IVY */}
                                        <ChartBase
                                            data={streamData?.candles || []}
                                            height={400}
                                            isLoading={isStreamLoading}
                                            interval={chartInterval}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <SwapWidget />
                    </div>
                </SwapProvider>
            </div>
        </div>
    );
}
