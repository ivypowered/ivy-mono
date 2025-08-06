"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { SwapProvider } from "@/components/swap/SwapProvider";
import { SwapToken } from "@/components/swap/swapTypes";
import { ChartInterval, ChartTab } from "@/components/chart/chartTypes";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { GameObject } from "@/lib/game";
import ReactMarkdown from "react-markdown";
import {
    IVY_MINT_B58,
    WSOL_MINT,
    TRANSPARENT_1X1,
    USDC_MINT_B58,
    USDT_MINT,
} from "@/lib/constants";
import { ChartHeader } from "../chart/ChartHeader";
import { Frame } from "../frame";
import { PublicKey } from "@solana/web3.js";
import { Api } from "@/lib/api";
import {
    fetchWebMetadata,
    Game,
    Auth,
    GAME_DECIMALS,
    TEXT_ENCODER,
    WebMetadata,
} from "@/import/ivy-sdk";
import { infinitely } from "@/lib/utils";
import { ChartBase } from "../chart/ChartBase";
import { useTokens } from "@/lib/hooks";
import { TreasuryManager } from "./TreasuryManager";
import { useChartData } from "./useChartData";
import { fetchQuoteInternal } from "./fetchQuoteInternal";
import { Comments } from "./Comments";
import { useWallet } from "../wallet/WalletProvider";

// Mock tokens
const COMMON_TOKENS = [
    {
        mint: WSOL_MINT.toBase58(),
        symbol: "SOL",
        name: "Solana",
        decimals: 9,
        icon: "/assets/images/sol.png",
    },
    {
        mint: USDC_MINT_B58,
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        icon: "/assets/images/usdc.png",
    },
    {
        mint: USDT_MINT.toBase58(),
        symbol: "USDT",
        name: "Tether",
        decimals: 6,
        icon: "/assets/images/usdt.svg",
    },
    {
        mint: IVY_MINT_B58,
        symbol: "IVY",
        name: "Ivy",
        decimals: 9,
        icon: "/assets/images/ivy-icon.svg",
    },
];

const SOL = COMMON_TOKENS[0];

async function fetchTransactionEffects(
    user: PublicKey,
    signature: string,
    inputMint: string,
    outputMint: string,
): Promise<{ input: number; output: number }> {
    const tokenDeltas = await Api.getTransactionTokenDeltas(user, signature);
    const inputDelta = tokenDeltas[inputMint] || 0;
    const outputDelta = tokenDeltas[outputMint] || 0;
    if (inputDelta > 0) {
        throw new Error(
            `inconsistency: TX swap input -> output resulted in POSITIVE input +${inputDelta}??`,
        );
    }
    if (outputDelta < 0) {
        throw new Error(
            `inconsistency: TX swap input -> output resulted in NEGATIVE output ${outputDelta}??`,
        );
    }
    return {
        input: Math.abs(inputDelta),
        output: outputDelta,
    };
}

async function fetchBalance(
    user: PublicKey,
    token: SwapToken,
): Promise<number> {
    const b = await Api.getTokenBalance(user, new PublicKey(token.mint));
    return parseInt(b) / Math.pow(10, token.decimals);
}

// Main game display content
export function GameDisplay({
    game,
    showComments,
}: {
    game: GameObject;
    showComments: boolean;
}) {
    const { publicKey, signTransaction, signMessage, openModal } = useWallet();
    const tokens = useTokens();
    const [metadata, setMetadata] = useState<WebMetadata | undefined>(
        game.metadata_override,
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

    useEffect(() => {
        if (game.metadata_override) {
            setMetadata(game.metadata_override);
            return;
        }
        let active = true;
        infinitely(
            /* f */ () => fetchWebMetadata(game.metadata_url),
            /* desc */ "fetch game metadata",
            /* continue_ */ () => active,
        ).then((m) => setMetadata(m));
        return () => {
            active = false;
        };
    }, [game.metadata_url, game.metadata_override]);

    const gameToken = useMemo(() => {
        return {
            name: game.name,
            symbol: game.symbol,
            icon: metadata?.image || TRANSPARENT_1X1,
            decimals: GAME_DECIMALS,
            mint:
                game.mint_override ||
                Game.deriveAddresses(
                    new PublicKey(game.address),
                ).mint.toBase58(),
        };
    }, [game, metadata]);

    const fetchQuote = useMemo(
        () =>
            (
                user: PublicKey | undefined,
                inputToken: SwapToken,
                outputToken: SwapToken,
                inputAmount: number,
                outputAmount: number,
                slippageBps: number,
            ) => {
                const gameAddress = new PublicKey(game.address);
                const gameSwapAlt = new PublicKey(game.swap_alt);
                const gameMint = gameToken.mint;
                return fetchQuoteInternal(
                    user,
                    gameAddress,
                    gameSwapAlt,
                    gameMint,
                    inputToken,
                    outputToken,
                    inputAmount,
                    outputAmount,
                    slippageBps,
                );
            },
        [game, gameToken],
    );

    // Used for chart data
    const {
        data: chartData,
        marketCap: chartMarketCap,
        changePercent: chartChangePercent,
        loading: isChartLoading,
    } = useChartData(game.address, chartInterval);

    // Calculate price data for chart
    const [priceUsd, setPriceUsd] = useState(game.last_price_usd);
    useEffect(() => {
        // Derive price from the last candle's close price if available
        if (chartData && chartData.length > 0) {
            setPriceUsd(chartData[chartData.length - 1].close);
        }
    }, [chartData, gameToken.symbol]);
    const [changePercentUsd, setChangePercentUsd] = useState(
        game.change_pct_24h,
    );
    useEffect(() => {
        if (typeof chartChangePercent === "number") {
            setChangePercentUsd(chartChangePercent);
        }
    }, [chartChangePercent]);
    const [marketCap, setMarketCap] = useState(game.mkt_cap_usd);
    useEffect(() => {
        if (typeof chartMarketCap === "number") {
            setMarketCap(chartMarketCap);
        }
    }, [chartMarketCap]);

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

    const [frameSrc, setFrameSrc] = useState("about:blank");
    const [frameOrigin, setFrameOrigin] = useState("about:blank");
    useEffect(() => {
        let u: URL;
        try {
            u = new URL(game.game_url);
            u.searchParams.append("parentOrigin", window.origin);
            setFrameSrc(u.toString());
            setFrameOrigin(u.origin);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
            setFrameSrc("about:blank");
            setFrameOrigin("about:blank");
        }
    }, [game.game_url]);

    const [frameWindow, setFrameWindow] = useState<Window | null>(null);
    const [subscribed, setSubscribed] = useState<boolean>(false);
    const [frameState, setFrameState] = useState<{
        user: string | null;
        message: string | null;
        signature: string | null;
    }>({ user: null, message: null, signature: null });
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
    }, [frameState, setFrameState]);
    const [subscribeKey, setSubscribeKey] = useState<number>(0);
    useEffect(() => {
        if (!subscribed || !frameWindow) {
            return;
        }
        frameWindow.postMessage(frameState, frameOrigin);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frameState, subscribed, subscribeKey, frameWindow]);
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {}
            return {
                user: publicKey.toBase58(),
                message,
                signature,
            };
        });
    }, [publicKey, game.address]);
    const balanceReloadRateLimit = useRef<{
        count: number;
        intervalEnd: number;
    }>({ count: 0, intervalEnd: 0 });
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
                    // reload_balance rate limiting
                    const now = Math.floor(new Date().getTime() / 1000); // unix
                    const rl = balanceReloadRateLimit.current;
                    if (now > rl.intervalEnd) {
                        rl.count = 0;
                        rl.intervalEnd = now + 60;
                    }
                    rl.count++;
                    if (rl.count > 15) {
                        // no more than 15 balance reloads every 60 seconds
                        break;
                    }
                    // requires user
                    if (!publicKey) {
                        break;
                    }
                    const reloadFn = reloadBalancesRef.current;
                    if (reloadFn) {
                        // use the treasury mgmt's reload fn
                        // if we have it
                        reloadFn();
                        break;
                    }
                    // otherwise update swap state manually
                    const updateFn = updateBalanceRef.current;
                    if (!updateFn) {
                        break;
                    }
                    const mint = Game.deriveAddresses(
                        new PublicKey(game.address),
                    ).mint;
                    try {
                        const balance = await Api.getTokenBalance(
                            publicKey,
                            mint,
                        );
                        updateFn(mint.toBase58(), Number(balance) / 1e9);
                        // eslint-disable-next-line
                    } catch (_e) {}
                    break;
                case "sign_message":
                    if (!publicKey) {
                        break;
                    }
                    const message = Auth.createMessage(
                        new PublicKey(game.address),
                        publicKey,
                    );
                    if (!signMessage) {
                        console.error("Can't find signMessage");
                        break;
                    }
                    const signature = Buffer.from(
                        await signMessage(TEXT_ENCODER.encode(message)),
                    ).toString("hex");
                    try {
                        window.localStorage.setItem(
                            `ivy-auth-${game.address}-${publicKey.toBase58()}`,
                            JSON.stringify({ message, signature }),
                        );
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (_e) {}
                    setFrameState((s) => {
                        if (!s.user || s.user !== publicKey.toBase58()) {
                            // user has changed since we requested signature
                            // leave state unchanged
                            return s;
                        }
                        return {
                            user: publicKey.toBase58(),
                            message,
                            signature,
                        };
                    });
                    break;
                case "logout":
                    setFrameState((s) => {
                        if (!s.user || !s.message || !s.signature) {
                            // user is already logged out
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
                    break;
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameOrigin, game, publicKey, openModal, signMessage]);

    const reloadBalancesRef = useRef<(() => void) | null>(null);
    const updateBalanceRef = useRef<
        ((mint: string, amount: number) => void) | null
    >(null);

    return (
        <div className="w-full flex flex-col items-center py-8">
            <div className="w-full max-w-[1080px] px-4">
                <SwapProvider
                    connectWallet={() => {
                        openModal();
                    }}
                    commonTokens={COMMON_TOKENS}
                    fetchBalance={fetchBalance}
                    fetchTransactionEffects={fetchTransactionEffects}
                    fetchQuote={fetchQuote}
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
                    initialInputToken={SOL}
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
                                        {/* Keep the Frame mounted all the time but toggle visibility */}
                                        <Frame
                                            src={frameSrc}
                                            title={game.name}
                                            className={`w-full h-full ${activeTab === "Game" ? "" : "hidden"}`}
                                            minHeight={400}
                                            showFullscreenButton={true}
                                            setFrameWindow={setFrameWindow}
                                        />

                                        {/* Show the chart when Chart tab is active */}
                                        {activeTab === "Chart" && (
                                            <ChartBase
                                                data={chartData || []}
                                                height={400}
                                                isLoading={isChartLoading}
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
                {showComments && (
                    <div className="mt-8 space-y-4">
                        {/* Comments Display */}
                        <Comments
                            gameAddress={game.address}
                            userAddress={publicKey?.toBase58()}
                            onConnectWallet={() => openModal()}
                            signTransaction={
                                signTransaction ||
                                (() => {
                                    throw new Error(
                                        "can't find signTransaction",
                                    );
                                })
                            }
                            initialCommentBufIndex={game.comment_buf_index}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
