"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { SwapProvider } from "@/components/swap/SwapProvider";
import { SwapToken, Quote } from "@/components/swap/swapTypes";
import {
    ChartCandle,
    ChartInterval,
    ChartTab,
} from "@/components/chart/chartTypes";
import { Time } from "lightweight-charts";
import { SwapWidget } from "@/components/swap/SwapWidget";
import { GameObject } from "@/lib/game";
import ReactMarkdown from "react-markdown";
import {
    DEFAULT_SLIPPAGE_BPS,
    IVY_MINT_B58,
    SOL_MINT,
    TRANSPARENT_1X1,
    USDC_MINT_B58,
    USDT_MINT,
} from "@/lib/constants";
import { ChartHeader } from "../chart/ChartHeader";
import { Frame } from "../frame";
import {
    ComputeBudgetProgram,
    PublicKey,
    Transaction,
    VersionedTransaction,
} from "@solana/web3.js";
import { Api, ChartKind, ChartResponse } from "@/lib/api";
import {
    fetchWebMetadata,
    Game,
    Auth,
    GAME_DECIMALS,
    TEXT_ENCODER,
    WebMetadata,
} from "@/import/ivy-sdk";
import { cn, infinitely, sfcap, unwrap } from "@/lib/utils";
import {
    fetchBuyIvyQuote,
    fetchBuyQuote,
    fetchSellIvyQuote,
    fetchSellQuote,
} from "@/lib/quote";
import {
    createBuyIvyTransaction,
    createBuyTransaction,
    createSellIvyTransaction,
    createSellTransaction,
} from "@/lib/execute";
import { ChartBase } from "../chart/ChartBase";
import { useWallet } from "../wallet/WalletProvider";
import { Skeleton } from "../ui/skeleton";
import { DecimalInput } from "../swap/DecimalInput";
import { Button } from "../ui/button";
import {
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    CheckCircle,
    Wallet,
} from "lucide-react";

// Mock tokens
const COMMON_TOKENS = [
    {
        mint: SOL_MINT.toBase58(),
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

const CHART_UPDATE_INTERVAL = 3; // in seconds

export function useChartData(gameAddress: string, interval: ChartInterval) {
    const [data, setData] = useState<ChartCandle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [marketCap, setMarketCap] = useState<number | undefined>(undefined);
    const [changePercent, setChangePercent] = useState<number | undefined>(
        undefined,
    );

    // Use refs to track the latest open_time and prevent stale closures in setInterval
    const lastOpenTimeRef = useRef<number>(0);
    const gameAddressRef = useRef(gameAddress);
    const intervalRef = useRef(interval);

    // Update refs when props change
    useEffect(() => {
        gameAddressRef.current = gameAddress;
        intervalRef.current = interval;
        lastOpenTimeRef.current = 0; // Reset on game/interval change
    }, [gameAddress, interval]);

    useEffect(() => {
        let isMounted = true;

        const fetchAndProcessData = async (isInitialFetch: boolean) => {
            if (!isMounted) return;

            if (isInitialFetch) {
                setLoading(true);
                setError(null);
            }

            try {
                const afterInclusive = isInitialFetch
                    ? 0
                    : lastOpenTimeRef.current;
                const chartResponse = await fetchChartData(afterInclusive);
                if (!isMounted) return;

                processChartData(chartResponse, isInitialFetch);
                if (isInitialFetch) setLoading(false);
            } catch (err) {
                if (!isMounted) return;
                console.error("Error fetching chart data:", err);
                setError(
                    err instanceof Error ? err : new Error("Unknown error"),
                );
                if (isInitialFetch) setLoading(false);
            }
        };

        // Helper to fetch the appropriate chart data
        const fetchChartData = async (afterInclusive: number) => {
            if (gameAddressRef.current === IVY_MINT_B58) {
                return Api.getIvyChart(
                    intervalRef.current as ChartKind,
                    100,
                    afterInclusive,
                );
            }

            const gameMint = new PublicKey(gameAddressRef.current);
            return Api.getGameChart(
                gameMint,
                intervalRef.current as ChartKind,
                100,
                afterInclusive,
            );
        };

        // Helper to process and update chart data
        const processChartData = (
            chartResponse: ChartResponse,
            isInitialFetch: boolean,
        ) => {
            const newCandles = chartResponse.candles.map((candle) => ({
                time: candle.open_time as Time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
                value: candle.volume,
            }));

            if (newCandles.length === 0) return;

            // Update the last open time for subsequent fetches
            lastOpenTimeRef.current = newCandles[newCandles.length - 1]
                .time as number;

            if (isInitialFetch) {
                setData(newCandles);
                return;
            }

            setData((prevData) => {
                if (prevData.length === 0) return newCandles;
                // New candles contain the updated last candle, plus any new candles
                return [
                    ...prevData.slice(0, prevData.length - 1),
                    ...newCandles,
                ];
            });

            setMarketCap(chartResponse.mkt_cap_usd);
            setChangePercent(chartResponse.change_24h);
        };

        // Initial fetch
        fetchAndProcessData(true);

        // Set up interval for updates
        const intervalId = setInterval(
            () => fetchAndProcessData(false),
            CHART_UPDATE_INTERVAL * 1000,
        );

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [gameAddress, interval]);

    return { data, marketCap, changePercent, loading, error };
}

export async function fetchBalance(
    user: PublicKey,
    token: SwapToken,
): Promise<number> {
    const b = await Api.getTokenBalance(user, new PublicKey(token.mint));
    return parseInt(b) / Math.pow(10, token.decimals);
}

async function fetchQuoteInternal(
    user: PublicKey | undefined,
    game: PublicKey,
    gameSwapAlt: PublicKey,
    gameMint: string,
    inputToken: SwapToken,
    outputToken: SwapToken,
    inputAmount: number,
    outputAmount: number,
): Promise<Quote> {
    if (!inputAmount || outputAmount) {
        throw new Error("Only ExactIn, non-zero swaps are supported");
    }

    let quote: Quote;
    let getTx: () => Promise<Transaction | VersionedTransaction>;

    if (inputToken.mint !== gameMint && outputToken.mint === IVY_MINT_B58) {
        // We're buying IVY
        const inputMint = new PublicKey(inputToken.mint);
        const q = await fetchBuyIvyQuote(
            /* user */ user,
            /* inputToken */ inputMint,
            /* inputAmount */ inputAmount,
            /* inputDecimals */ inputToken.decimals,
            /* slippageBps */ DEFAULT_SLIPPAGE_BPS,
        );

        getTx = () =>
            createBuyIvyTransaction(
                /* user */ unwrap(user, "must have user to create tx"),
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* txBase64 */ q.txBase64,
            );
        quote = q;
    } else if (
        inputToken.mint === IVY_MINT_B58 &&
        outputToken.mint !== gameMint
    ) {
        // We're selling IVY
        const outputMint = new PublicKey(outputToken.mint);
        const q = await fetchSellIvyQuote(
            /* user */ user,
            /* outputToken */ outputMint,
            /* ivyAmount */ inputAmount,
            /* outputDecimals */ outputToken.decimals,
            /* slippageBps */ DEFAULT_SLIPPAGE_BPS,
        );

        getTx = () =>
            createSellIvyTransaction(
                /* user */ unwrap(user, "must have user to create tx"),
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* txBase64 */ q.txBase64,
            );
        quote = q;
    } else if (outputToken.mint === gameMint) {
        // We're buying the game token
        const inputMint = new PublicKey(inputToken.mint);
        const q = await fetchBuyQuote(
            /* user */ user,
            /* game */ game,
            /* inputToken */ inputMint,
            /* inputAmount */ inputAmount,
            /* inputDecimals */ inputToken.decimals,
            /* slippageBps */ DEFAULT_SLIPPAGE_BPS,
        );

        getTx = () =>
            createBuyTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ unwrap(user, "must have user to create tx"),
                /* game */ game,
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* txBase64 */ q.txBase64,
            );
        quote = q;
    } else {
        // We're selling game token
        const outputMint = new PublicKey(outputToken.mint);
        const q = await fetchSellQuote(
            /* user */ user,
            /* game */ game,
            /* outputToken */ outputMint,
            /* inputAmount */ inputAmount,
            /* outputDecimals */ outputToken.decimals,
            /* slippageBps */ DEFAULT_SLIPPAGE_BPS,
        );

        getTx = () =>
            createSellTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ unwrap(user, "must have user to create tx"),
                /* game */ game,
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* txBase64 */ q.txBase64,
            );
        quote = q;
    }

    quote.getTransaction = async function () {
        const [ctx, tx] = await Promise.all([Api.getContext(), getTx()]);
        if (tx instanceof Transaction) {
            tx.recentBlockhash = ctx.blockhash;
            tx.lastValidBlockHeight = ctx.lastValidBlockHeight;
            let existingBudgetIx = false;
            for (const ins of tx.instructions) {
                if (
                    ins.programId.equals(ComputeBudgetProgram.programId) &&
                    ins.data.length > 0 &&
                    ins.data[0] === 3 // SetComputeUnitPrice
                ) {
                    existingBudgetIx = true;
                    break;
                }
            }
            if (!existingBudgetIx && ctx.reasonablePriorityFee > 0) {
                tx.instructions.unshift(
                    ComputeBudgetProgram.setComputeUnitPrice({
                        microLamports: ctx.reasonablePriorityFee,
                    }),
                );
            }
        } else {
            const computeBudgetProgramIx =
                tx.message.staticAccountKeys.findIndex((x) =>
                    x.equals(ComputeBudgetProgram.programId),
                );
            let existingBudgetIx = false;
            if (computeBudgetProgramIx >= 0) {
                for (const ins of tx.message.compiledInstructions) {
                    if (
                        ins.programIdIndex === computeBudgetProgramIx &&
                        ins.data.length > 0 &&
                        ins.data[0] === 3 // SetComputeUnitPrice
                    ) {
                        existingBudgetIx = true;
                        break;
                    }
                }
            }
            if (!existingBudgetIx) {
                // Jupiter produces VersionedTransactions, and they should
                // be adding a priority fee!
                // (If we see this message, we should actually code
                // in priority fee logic)
                console.warn("Warning: Jupiter did not add a priority fee!");
            }
            tx.message.recentBlockhash = ctx.blockhash;
        }
        return {
            tx,
            lastValidBlockHeight: ctx.lastValidBlockHeight,
        };
    };

    return quote;
}

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

interface TreasuryManagerProps {
    game: GameObject;
    userAddress: string;
    signTransaction: (
        tx: Transaction,
    ) => Promise<Transaction | VersionedTransaction>;
    reloadBalancesRef: {
        current: (() => void) | null;
    };
    updateBalance: (mint: string, amount: number) => void;
}

type ActionType = "deposit" | "withdraw";

export function TreasuryManager({
    game,
    userAddress,
    signTransaction,
    reloadBalancesRef,
    updateBalance,
}: TreasuryManagerProps) {
    const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<ActionType>("withdraw");

    const fetchBalances = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch both treasury and user balances
            const gameMint = Game.deriveAddresses(
                new PublicKey(game.address),
            ).mint;
            const [treasuryBalanceStr, userBalanceStr] = await Promise.all([
                Api.getTreasuryBalance(new PublicKey(game.address)),
                Api.getTokenBalance(new PublicKey(userAddress), gameMint),
            ]);

            setTreasuryBalance(
                Number.parseInt(treasuryBalanceStr) / 1_000_000_000,
            );
            const userBalance = Number.parseInt(userBalanceStr) / 1_000_000_000;
            setUserBalance(userBalance);
            updateBalance(gameMint.toBase58(), userBalance);
        } catch (err) {
            console.error("Failed to fetch balances:", err);
            setError("Could not load balances");
        } finally {
            setIsLoading(false);
        }
    }, [game, updateBalance, userAddress]);

    useEffect(() => {
        reloadBalancesRef.current = fetchBalances;
    }, [reloadBalancesRef, fetchBalances]);

    useEffect(() => {
        // Fetch balances when component mounts
        fetchBalances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.address, userAddress]);

    const handleMaxClick = () => {
        if (activeAction === "withdraw" && treasuryBalance !== null) {
            setAmount(treasuryBalance);
        } else if (activeAction === "deposit" && userBalance !== null) {
            setAmount(userBalance);
        }
    };

    const handleAction = async () => {
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Please enter a valid amount");
            }

            if (activeAction === "withdraw") {
                if (treasuryBalance !== null && amount > treasuryBalance) {
                    throw new Error("Amount exceeds treasury balance");
                }

                // Process withdrawal
                const [ctx, tx] = await Promise.all([
                    await Api.getContext(),
                    await Game.debit(
                        new PublicKey(game.address),
                        String(Math.floor(amount * 1_000_000_000)),
                        new PublicKey(userAddress),
                    ),
                ]);
                if (ctx.reasonablePriorityFee > 0) {
                    tx.instructions.unshift(
                        ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: ctx.reasonablePriorityFee,
                        }),
                    );
                }
                tx.recentBlockhash = ctx.blockhash;
                tx.feePayer = new PublicKey(userAddress);
                await Api.confirmTransaction(
                    await Api.sendTransaction(await signTransaction(tx)),
                    ctx.lastValidBlockHeight,
                );

                setSuccess(`Withdrew ${amount} ${game.symbol}`);
            } else {
                if (userBalance !== null && amount > userBalance) {
                    throw new Error("Amount exceeds your balance");
                }

                // Process deposit
                const [ctx, tx] = await Promise.all([
                    await Api.getContext(),
                    await Game.debit(
                        new PublicKey(game.address),
                        String(Math.floor(amount * 1_000_000_000)),
                        new PublicKey(userAddress),
                    ),
                ]);
                if (ctx.reasonablePriorityFee > 0) {
                    tx.instructions.unshift(
                        ComputeBudgetProgram.setComputeUnitPrice({
                            microLamports: ctx.reasonablePriorityFee,
                        }),
                    );
                }
                tx.recentBlockhash = ctx.blockhash;
                tx.feePayer = new PublicKey(userAddress);
                await Api.confirmTransaction(
                    await Api.sendTransaction(await signTransaction(tx)),
                    ctx.lastValidBlockHeight,
                );

                setSuccess(`Deposited ${amount} ${game.symbol}`);
            }

            // Refresh balances after transaction
            await fetchBalances();
            setAmount(0);
        } catch (err) {
            console.error("Transaction failed:", err);
            setError(err instanceof Error ? err.message : "Transaction failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-none shadow-lg border-4 border-emerald-400">
            <div className="text-sm text-emerald-400 mb-4 font-bold">
                Treasury Management
            </div>

            {/* Action Tabs */}
            <div className="flex mb-4 border-2 border-emerald-400">
                <button
                    className={cn(
                        "flex-1 py-2 font-bold text-center",
                        activeAction === "withdraw"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-transparent text-emerald-400 hover:bg-emerald-400/10",
                    )}
                    onClick={() => {
                        setActiveAction("withdraw");
                        setAmount(0);
                        setError(null);
                        setSuccess(null);
                    }}
                >
                    <ArrowUpFromLine className="h-4 w-4 inline-block mr-2" />
                    Withdraw
                </button>
                <button
                    className={cn(
                        "flex-1 py-2 font-bold text-center",
                        activeAction === "deposit"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-transparent text-emerald-400 hover:bg-emerald-400/10",
                    )}
                    onClick={() => {
                        setActiveAction("deposit");
                        setAmount(0);
                        setError(null);
                        setSuccess(null);
                    }}
                >
                    <ArrowDownToLine className="h-4 w-4 inline-block mr-2" />
                    Deposit
                </button>
            </div>

            {/* Balances */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-sm text-zinc-400">
                    <Wallet className="h-4 w-4 mr-2 text-emerald-400" />
                    {isLoading ? (
                        <Skeleton className="h-4 w-20 rounded-none border border-zinc-700" />
                    ) : (
                        <span className="text-white">
                            {activeAction === "withdraw"
                                ? `Treasury: ${treasuryBalance !== null ? sfcap(treasuryBalance, 6) : "N/A"}`
                                : `Your balance: ${userBalance !== null ? sfcap(userBalance, 6) : "N/A"}`}{" "}
                            {game.symbol}
                        </span>
                    )}
                </div>
            </div>

            {/* Amount Input */}
            <div className="flex mb-4 relative">
                {amount === undefined ? (
                    <Skeleton className="h-10 w-full rounded-none border-2 border-zinc-700" />
                ) : (
                    <DecimalInput
                        className="w-full bg-zinc-800 border-2 border-emerald-400 text-white p-2 focus-visible:ring-0 focus-visible:outline-none"
                        value={amount}
                        onValueChange={setAmount}
                        disabled={isProcessing}
                    />
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold transition-none"
                    onClick={handleMaxClick}
                    disabled={
                        isProcessing ||
                        (activeAction === "withdraw"
                            ? treasuryBalance === null
                            : userBalance === null)
                    }
                >
                    Max
                </Button>
            </div>

            {/* Action Button */}
            <Button
                className="w-full h-12 rounded-none border-2 text-base font-bold transition-none border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                onClick={handleAction}
                disabled={
                    isProcessing ||
                    amount <= 0 ||
                    (activeAction === "withdraw"
                        ? !treasuryBalance
                        : !userBalance)
                }
            >
                {isProcessing
                    ? "loading..."
                    : activeAction === "withdraw"
                      ? "withdraw"
                      : "deposit"}
            </Button>

            {/* Status Messages */}
            {error && (
                <div className="mt-4 p-3 border-2 border-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span className="text-white">{error}</span>
                </div>
            )}

            {success && (
                <div className="mt-4 p-3 border-2 border-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span className="text-white">{success}</span>
                </div>
            )}
        </div>
    );
}

// Main game display content
export function GameDisplay({ game }: { game: GameObject }) {
    const { publicKey, signTransaction, signMessage, setShowModal } =
        useWallet();
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
    useEffect(() => {
        if (!subscribed || !frameWindow) {
            return;
        }
        frameWindow.postMessage(frameState, frameOrigin);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frameState, subscribed, frameWindow]);
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
                    break;
                case "connect_wallet":
                    setShowModal(true);
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
            }
        };
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [frameOrigin, game, publicKey, setShowModal, signMessage]);

    const reloadBalancesRef = useRef<(() => void) | null>(null);
    const updateBalanceRef = useRef<
        ((mint: string, amount: number) => void) | null
    >(null);
    return (
        <div className="w-full flex flex-col items-center py-8">
            <div className="w-full max-w-[1080px] px-4">
                <SwapProvider
                    connectWallet={() => {
                        setShowModal(true);
                    }}
                    commonTokens={COMMON_TOKENS}
                    confirmTransaction={Api.confirmTransaction}
                    fetchBalance={fetchBalance}
                    fetchTransactionEffects={fetchTransactionEffects}
                    fetchQuote={fetchQuote}
                    reloadBalances={reloadBalancesRef.current || (() => {})}
                    sendTransaction={Api.sendTransaction}
                    signTransaction={
                        signTransaction ||
                        (() => {
                            throw new Error(
                                "can't sign transaction: signTransaction not found",
                            );
                        })
                    }
                    tokens={COMMON_TOKENS}
                    initialInputToken={SOL}
                    initialOutputToken={gameToken}
                    user={publicKey || undefined}
                    updateBalanceRef={updateBalanceRef}
                >
                    {/* Inlined SwapAndChartLayout */}
                    <div className="grid w-full grid-cols-1 lg:grid-cols-10 gap-4">
                        <div className="relative flex w-full flex-col gap-y-4 overflow-hidden border-4 border-emerald-400 lg:col-span-6 lg:self-start">
                            {/* Container for tab content */}
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
            </div>
        </div>
    );
}
