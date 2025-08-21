import { useEffect, useState, useMemo, useRef } from "react";
import { PublicKey } from "@solana/web3.js";
import { Decimal } from "decimal.js-light";
import { USDC_MINT } from "@/lib/constants";
import { Jup } from "@/lib/jup";
import { Curve } from "@/lib/curve";
import { GameReserves, WorldReserves, FeeConfig } from "@/lib/useQuote";

export interface StepResult {
    amount: Decimal | undefined;
    priceImpactBps: number;
    jupQuoteResponse: unknown | null;
    inputUsd: Decimal | undefined; // Original input value in USD
    outputUsd: Decimal | undefined; // Output value in USD for this step
    worldReserves: WorldReserves | null; // original, or modified (in our imagination) world reserves
}

// ANY -> USDC via Jupiter
export function useAnyToUsdc(
    input: StepResult,
    inputToken: PublicKey,
    inputDecimals: number,
    slippageBps: number,
    refreshKey: number,
    enabled: boolean,
): StepResult {
    const [cache, setCache] = useState<{
        key: string;
        output: Decimal;
        priceImpactBps: number;
        jupQuoteResponse: unknown;
        inputPrice: number;
    } | null>(null);

    // Track the latest request ID to handle race conditions
    const latestRequestId = useRef(0);

    const cacheKey = `${inputToken.toBase58()}-${input.amount?.toString()}-${slippageBps}-${refreshKey}`;

    useEffect(() => {
        if (!enabled || !input.amount || input.amount.isZero()) {
            setCache(null);
            return;
        }
        const inputAmount = input.amount;

        if (cache?.key === cacheKey) return;

        // Increment request ID for this request
        const requestId = ++latestRequestId.current;

        setCache(null);

        (async () => {
            try {
                const inputRaw = inputAmount
                    .mul(new Decimal(10).pow(inputDecimals))
                    .toFixed(0);

                const [quoteResponse, prices] = await Promise.all([
                    Jup.fetchQuote(
                        inputToken,
                        USDC_MINT,
                        parseInt(inputRaw),
                        slippageBps,
                        {
                            swapMode: "ExactIn",
                            onlyDirectRoutes: true,
                            asLegacyTransaction: false,
                            maxAccounts: 24,
                            restrictIntermediateTokens: true,
                            excludeDexes: ["Obric V2"],
                        },
                    ),
                    Jup.fetchPrices([inputToken]),
                ]);

                // Only update if this is still the latest request
                if (requestId === latestRequestId.current) {
                    const outputUsdc = new Decimal(quoteResponse.outAmount).div(
                        1e6,
                    );
                    const priceImpactBps =
                        parseFloat(quoteResponse.priceImpactPct) * 10000;

                    setCache({
                        key: cacheKey,
                        output: outputUsdc,
                        priceImpactBps,
                        jupQuoteResponse: quoteResponse,
                        inputPrice: prices[0],
                    });
                }
            } catch (error) {
                // Only log error if this is still the latest request
                if (requestId === latestRequestId.current) {
                    console.error("Failed to fetch Jupiter quote:", error);
                }
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        input.amount?.toString(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputToken.toBase58(),
        inputDecimals,
        slippageBps,
        refreshKey,
        cacheKey,
    ]);

    if (!enabled) return input;
    if (!input.amount || !cache || cacheKey !== cache.key)
        return { ...input, amount: undefined };

    const calculatedInputUsd = input.amount.mul(cache.inputPrice);

    return {
        amount: cache.output,
        priceImpactBps: Math.max(input.priceImpactBps, cache.priceImpactBps),
        jupQuoteResponse: cache.jupQuoteResponse,
        inputUsd: input.inputUsd || calculatedInputUsd, // Set inputUsd if not already set
        outputUsd: cache.output, // USDC amount is already in USD
        worldReserves: input.worldReserves,
    };
}

// USDC -> IVY via bonding curve (returns updated world reserves)
export function useUsdcToIvy(input: StepResult, enabled: boolean): StepResult {
    return useMemo(() => {
        if (!enabled) return input;
        if (!input.amount) return { ...input, amount: undefined };
        if (!input.worldReserves) return { ...input, amount: undefined };

        const worldReserves = input.worldReserves;

        const quote = Curve.calculateIvyQuote(
            worldReserves.ivySold,
            worldReserves.ivyCurveMax,
            worldReserves.curveInputScale,
            input.amount,
            true, // isBuy
        );

        // Handle null return from curve calculation
        if (!quote) {
            return { ...input, amount: undefined };
        }

        // Update world reserves (in our imagination)
        const updatedWorldReserves = {
            ...worldReserves,
            ivySold: worldReserves.ivySold.add(quote.outputAmount),
        };

        return {
            amount: quote.outputAmount,
            priceImpactBps: Math.max(
                input.priceImpactBps,
                quote.priceImpactBps,
            ),
            jupQuoteResponse: input.jupQuoteResponse,
            inputUsd: input.inputUsd || input.amount,
            outputUsd: quote.outputAmountUsd,
            worldReserves: updatedWorldReserves, // Pass along updated reserves
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        input.amount?.toString(),
        input.worldReserves,
        input.inputUsd,
    ]);
}

// IVY -> GAME via AMM (uses updated world reserves)
export function useIvyToGame(
    input: StepResult,
    gameReserves: GameReserves | null,
    feeConfig: FeeConfig | null,
    enabled: boolean,
): StepResult {
    return useMemo(() => {
        if (!enabled) return input;
        if (!input.amount || !input.worldReserves)
            return { ...input, amount: undefined };
        if (!gameReserves || !feeConfig) return { ...input, amount: undefined };

        const quote = Curve.calculateGameQuote(
            gameReserves.ivyBalance,
            gameReserves.gameBalance,
            input.amount,
            true, // isBuy
            feeConfig.ivyFeeBps,
            feeConfig.gameFeeBps,
            input.worldReserves, // Use the updated world reserves
        );

        // Handle null return from curve calculation
        if (!quote) {
            return { ...input, amount: undefined };
        }

        return {
            amount: quote.outputAmount,
            priceImpactBps: Math.max(
                input.priceImpactBps,
                quote.priceImpactBps,
            ),
            jupQuoteResponse: input.jupQuoteResponse,
            inputUsd: input.inputUsd || quote.inputAmountUsd,
            outputUsd: quote.outputAmountUsd,
            worldReserves: input.worldReserves, // Pass along unchanged
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        input.amount?.toString(),
        gameReserves,
        feeConfig,
        input.worldReserves,
        input.inputUsd,
    ]);
}

// GAME -> IVY via AMM (uses world reserves)
export function useGameToIvy(
    input: StepResult,
    gameReserves: GameReserves | null,
    feeConfig: FeeConfig | null,
    enabled: boolean,
): StepResult {
    return useMemo(() => {
        if (!enabled) return input;
        if (!input.amount || !input.worldReserves)
            return { ...input, amount: undefined };
        if (!gameReserves || !feeConfig) return { ...input, amount: undefined };

        const quote = Curve.calculateGameQuote(
            gameReserves.ivyBalance,
            gameReserves.gameBalance,
            input.amount,
            false, // isSell
            feeConfig.ivyFeeBps,
            feeConfig.gameFeeBps,
            input.worldReserves,
        );

        // Handle null return from curve calculation
        if (!quote) {
            return { ...input, amount: undefined };
        }

        return {
            amount: quote.outputAmount,
            priceImpactBps: Math.max(
                input.priceImpactBps,
                quote.priceImpactBps,
            ),
            jupQuoteResponse: input.jupQuoteResponse,
            inputUsd: input.inputUsd || quote.inputAmountUsd,
            outputUsd: quote.outputAmountUsd,
            worldReserves: input.worldReserves, // Pass along unchanged
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        input.amount?.toString(),
        gameReserves,
        feeConfig,
        input.worldReserves,
        input.inputUsd,
    ]);
}

// IVY -> USDC via bonding curve (updates world reserves)
export function useIvyToUsdc(input: StepResult, enabled: boolean): StepResult {
    return useMemo(() => {
        if (!enabled) return input;
        if (!input.amount) return { ...input, amount: undefined };
        if (!input.worldReserves) return { ...input, amount: undefined };

        const worldReserves = input.worldReserves;

        const quote = Curve.calculateIvyQuote(
            worldReserves.ivySold,
            worldReserves.ivyCurveMax,
            worldReserves.curveInputScale,
            input.amount,
            false, // isSell
        );

        // Handle null return from curve calculation
        if (!quote) {
            return { ...input, amount: undefined };
        }

        // Update world reserves (in our imagination)
        const updatedWorldReserves = {
            ...worldReserves,
            ivySold: worldReserves.ivySold.sub(input.amount),
        };

        return {
            amount: quote.outputAmount,
            priceImpactBps: Math.max(
                input.priceImpactBps,
                quote.priceImpactBps,
            ),
            jupQuoteResponse: input.jupQuoteResponse,
            inputUsd: input.inputUsd || quote.inputAmountUsd,
            outputUsd: quote.outputAmount,
            worldReserves: updatedWorldReserves, // Pass along updated reserves
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        input.amount?.toString(),
        input.worldReserves,
        input.inputUsd,
    ]);
}

// USDC -> ANY via Jupiter (with linear interpolation)
export function useUsdcToAny(
    input: StepResult,
    outputToken: PublicKey,
    outputDecimals: number,
    slippageBps: number,
    refreshKey: number,
    enabled: boolean,
): StepResult {
    const [loading, setLoading] = useState(false);
    const [cache, setCache] = useState<{
        inputUsdc: Decimal;
        output: Decimal;
        priceImpactBps: number;
        jupQuoteResponse: unknown;
        outputPrice: number;
    } | null>(null);

    // Track the latest request ID to handle race conditions
    const latestRequestId = useRef(0);

    // Fetch Jupiter quote for initial USDC amount
    useEffect(() => {
        if (!enabled || !input.amount || input.amount.isZero()) {
            return;
        }

        if (outputToken.equals(USDC_MINT)) {
            // Direct passthrough for USDC
            setCache({
                inputUsdc: input.amount,
                output: input.amount,
                priceImpactBps: 0,
                jupQuoteResponse: null,
                outputPrice: 1,
            });
            return;
        }

        const inputAmount = input.amount;

        // Only refetch if we don't have a cache or if refreshKey changed
        if (cache && refreshKey === 0) return;

        // Increment request ID for this request
        const requestId = ++latestRequestId.current;

        setLoading(true);

        (async () => {
            try {
                const usdcRaw = inputAmount.mul(1e6).toFixed(0);

                const [quoteResponse, prices] = await Promise.all([
                    Jup.fetchQuote(
                        USDC_MINT,
                        outputToken,
                        parseInt(usdcRaw),
                        slippageBps,
                        {
                            swapMode: "ExactIn",
                            onlyDirectRoutes: true,
                            asLegacyTransaction: false,
                            maxAccounts: 24,
                            restrictIntermediateTokens: true,
                            excludeDexes: ["Obric V2"],
                        },
                    ),
                    Jup.fetchPrices([outputToken]),
                ]);

                // Only update if this is still the latest request
                if (requestId === latestRequestId.current) {
                    const output = new Decimal(quoteResponse.outAmount).div(
                        new Decimal(10).pow(outputDecimals),
                    );
                    const priceImpactBps =
                        parseFloat(quoteResponse.priceImpactPct) * 10000;

                    setCache({
                        inputUsdc: inputAmount,
                        output,
                        priceImpactBps,
                        jupQuoteResponse: quoteResponse,
                        outputPrice: prices[0],
                    });
                }
            } catch (error) {
                // Only log error if this is still the latest request
                if (requestId === latestRequestId.current) {
                    console.error("Failed to fetch Jupiter quote:", error);
                }
            } finally {
                // Only update loading state if this is still the latest request
                if (requestId === latestRequestId.current) {
                    setLoading(false);
                }
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        enabled,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        outputToken.toBase58(),
        outputDecimals,
        slippageBps,
        refreshKey,
    ]);

    // Linear interpolation when USDC amount changes
    return useMemo(() => {
        if (!enabled) return input;
        if (!input.amount || !cache || loading)
            return { ...input, amount: undefined };

        // Linear interpolation
        const ratio = input.amount.div(cache.inputUsdc);
        const interpolatedOutput = cache.output.mul(ratio);

        return {
            amount: interpolatedOutput,
            priceImpactBps: Math.max(
                input.priceImpactBps,
                cache.priceImpactBps,
            ),
            jupQuoteResponse: cache.jupQuoteResponse,
            inputUsd: input.inputUsd || input.amount, // USDC amount is USD
            outputUsd: interpolatedOutput.mul(cache.outputPrice),
            worldReserves: input.worldReserves,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, input.amount?.toString(), cache, input.inputUsd]);
}
