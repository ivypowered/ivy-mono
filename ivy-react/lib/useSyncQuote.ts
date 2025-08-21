import { useMemo, useEffect, useState, useCallback } from "react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { Decimal } from "decimal.js-light";
import { Quote, SwapToken } from "@/components/swap/swapTypes";
import { WSOL_MINT_B58 } from "@/lib/constants";
import { Api } from "@/lib/api";
import { Curve } from "@/lib/curve";
import {
    Sync,
    SyncGlobal,
    SyncCurve,
    SyncPool,
    PUMP_GLOBAL,
    PSWAP_GLOBAL_CONFIG,
} from "@/import/ivy-sdk";

const PF_FEE_BPS = 100; // 1% fee on trades

// Use a subset of SyncStreamData for the sync info
export interface SyncQuoteInfo {
    solReserves: number;
    tokenReserves: number;
    isMigrated: boolean;
    pswapPool: string | null;
    solPrice: number;
}

interface SyncQuoteParams {
    user: PublicKey | undefined;
    syncInfo: SyncQuoteInfo | null;
    tokenMint: PublicKey;
    inputToken: SwapToken;
    outputToken: SwapToken;
    inputAmount: Decimal;
    outputAmount: Decimal;
    slippageBps: number;
}

// Hook to fetch and cache SyncGlobal
function useSyncGlobal() {
    const [syncGlobal, setSyncGlobal] = useState<SyncGlobal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let cancelled = false;

        const fetchGlobal = async () => {
            try {
                const [pumpGlobalData, pswapGlobalConfigData] =
                    await Api.getAccountsData([
                        PUMP_GLOBAL,
                        PSWAP_GLOBAL_CONFIG,
                    ]);

                if (cancelled) return;

                if (!pumpGlobalData || !pswapGlobalConfigData) {
                    throw new Error("Failed to fetch global accounts");
                }

                const global = SyncGlobal.create(
                    pumpGlobalData,
                    pswapGlobalConfigData,
                );
                setSyncGlobal(global);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to fetch SyncGlobal:", err);
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to fetch global data"),
                );
                setLoading(false);
            }
        };

        fetchGlobal();

        return () => {
            cancelled = true;
        };
    }, []);

    return { syncGlobal, loading, error };
}

// Hook to fetch and cache SyncCurve
function useSyncCurve(tokenMint: PublicKey | null) {
    const [syncCurve, setSyncCurve] = useState<SyncCurve | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!tokenMint) {
            setSyncCurve(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        const fetchCurve = async () => {
            try {
                const bondingCurve = SyncCurve.deriveBondingCurve(tokenMint);

                const [bondingCurveData] = await Api.getAccountsData([
                    bondingCurve,
                ]);

                if (cancelled) return;

                if (!bondingCurveData) {
                    // No bonding curve exists (maybe already migrated)
                    setSyncCurve(null);
                    setLoading(false);
                    return;
                }

                const curve = SyncCurve.create(
                    tokenMint,
                    bondingCurve,
                    bondingCurveData,
                );
                setSyncCurve(curve);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to fetch SyncCurve:", err);
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to fetch curve data"),
                );
                setLoading(false);
            }
        };

        fetchCurve();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenMint?.toBase58()]);

    return { syncCurve, loading, error };
}

// Hook to fetch and cache SyncPool
function useSyncPool(poolAddress: string | null) {
    const [syncPool, setSyncPool] = useState<SyncPool | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!poolAddress) {
            setSyncPool(null);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        const fetchPool = async () => {
            try {
                const poolPubkey = new PublicKey(poolAddress);
                const [poolData] = await Api.getAccountsData([poolPubkey]);

                if (cancelled) return;

                if (!poolData) {
                    throw new Error("Failed to fetch pool data");
                }

                const pool = SyncPool.create(poolPubkey, poolData);
                setSyncPool(pool);
                setLoading(false);
            } catch (err) {
                if (cancelled) return;
                console.error("Failed to fetch SyncPool:", err);
                setError(
                    err instanceof Error
                        ? err
                        : new Error("Failed to fetch pool data"),
                );
                setLoading(false);
            }
        };

        fetchPool();

        return () => {
            cancelled = true;
        };
    }, [poolAddress]);

    return { syncPool, loading, error };
}

// Calculate swap with fees using the existing Curve.swapBaseInput
function calculateSyncSwap(
    inputReserves: Decimal,
    outputReserves: Decimal,
    inputAmount: Decimal,
): {
    outputAmount: Decimal;
    priceImpactBps: number;
    amountAfterFee: Decimal;
} | null {
    if (
        inputAmount.isZero() ||
        inputReserves.isZero() ||
        outputReserves.isZero()
    ) {
        return {
            outputAmount: new Decimal(0),
            priceImpactBps: 0,
            amountAfterFee: new Decimal(0),
        };
    }

    // Calculate initial price for price impact
    const initialPrice = inputReserves.div(outputReserves);

    // Apply input fee
    const feeAmount = inputAmount.mul(PF_FEE_BPS).div(10_000);
    const amountAfterFee = inputAmount.sub(feeAmount);

    if (amountAfterFee.lte(0)) {
        return null;
    }

    // Use Curve.swapBaseInput for the constant product calculation
    const outputAmount = Curve.swapBaseInput(
        amountAfterFee,
        inputReserves,
        outputReserves,
    );

    if (!outputAmount || outputAmount.lte(0)) {
        return null;
    }

    // Calculate new reserves for price impact
    const newInputReserves = inputReserves.add(amountAfterFee);
    const newOutputReserves = outputReserves.sub(outputAmount);

    // Calculate price impact
    const newPrice =
        newInputReserves.gt(0) && newOutputReserves.gt(0)
            ? newInputReserves.div(newOutputReserves)
            : initialPrice;

    const priceImpactBps = initialPrice.gt(0)
        ? Math.min(
              Math.floor(
                  newPrice
                      .sub(initialPrice)
                      .abs()
                      .div(initialPrice)
                      .mul(10_000)
                      .toNumber(),
              ),
              10_000,
          )
        : 0;

    return {
        outputAmount,
        priceImpactBps,
        amountAfterFee,
    };
}

export function useSyncQuote({
    user,
    syncInfo,
    tokenMint,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    slippageBps,
}: SyncQuoteParams): Quote | null {
    // Fetch blockchain state objects
    const { syncGlobal } = useSyncGlobal();
    const { syncCurve } = useSyncCurve(
        syncInfo && !syncInfo.isMigrated ? tokenMint : null,
    );
    const { syncPool } = useSyncPool(syncInfo?.pswapPool || null);

    // Create Sync instance
    const [sync, setSync] = useState<Sync | null>(null);

    useEffect(() => {
        if (!tokenMint) {
            setSync(null);
            return;
        }

        Sync.fromMint(tokenMint)
            .then(setSync)
            .catch((err) => {
                console.error("Failed to create Sync instance:", err);
                setSync(null);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenMint.toBase58()]);

    // Create transaction getter
    const getTransaction = useCallback(async (): Promise<Transaction> => {
        if (!syncInfo || !user || !sync || !syncGlobal) {
            throw new Error("Missing required data for transaction");
        }

        const tx = new Transaction();

        // Convert decimal amounts to bigint (assuming 9 decimals for both SOL and token)
        const inputAmountRaw = BigInt(inputAmount.mul(1e9).toFixed(0));
        const minOutputRaw = BigInt(
            inputAmount
                .mul(1 - slippageBps / 10_000)
                .mul(1e9)
                .toFixed(0),
        );

        const isInputSol = inputToken.mint === WSOL_MINT_B58;
        const isBuy = isInputSol; // Buy = SOL -> Token, Sell = Token -> SOL

        if (!syncInfo.isMigrated) {
            // Use bonding curve swap
            if (!syncCurve) {
                throw new Error("Bonding curve data not available");
            }

            const instruction = await sync.swap(
                syncGlobal,
                syncCurve,
                user,
                isBuy,
                inputAmountRaw,
                minOutputRaw,
            );
            tx.add(instruction);
        } else {
            // Use PumpSwap AMM
            if (!syncPool) {
                throw new Error("Pool data not available");
            }

            const instruction = await sync.pswap(
                syncGlobal,
                syncPool,
                user,
                isBuy,
                inputAmountRaw,
                minOutputRaw,
            );
            tx.add(instruction);
        }

        return tx;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        sync,
        syncGlobal,
        syncCurve,
        syncPool,
        syncInfo?.isMigrated,
        inputToken.mint,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputAmount.toString(),
        slippageBps,
    ]);

    const quote = useMemo(() => {
        // Validate inputs
        if (!syncInfo || !user || inputAmount.isZero() || !sync) {
            return null;
        }

        // Check if output amount is specified (ExactOut mode not supported for simplicity)
        if (outputAmount && !outputAmount.isZero()) {
            console.warn("ExactOut mode not supported in Sync quotes");
            return null;
        }

        const isInputSol = inputToken.mint === WSOL_MINT_B58;
        const isOutputSol = outputToken.mint === WSOL_MINT_B58;
        const isInputToken = inputToken.mint === tokenMint.toBase58();
        const isOutputToken = outputToken.mint === tokenMint.toBase58();

        // Validate token pair
        if (!((isInputSol && isOutputToken) || (isInputToken && isOutputSol))) {
            console.error("Sync quote only supports SOL <-> TOKEN swaps");
            return null;
        }

        // Convert number reserves to Decimal
        const solReserves = new Decimal(syncInfo.solReserves);
        const tokenReserves = new Decimal(syncInfo.tokenReserves);

        let swapResult;
        let inputUSD: Decimal;
        let outputUSD: Decimal;

        // Calculate token price from pool reserves
        const tokenPriceInSol = solReserves.div(tokenReserves);
        const tokenPriceInUSD = tokenPriceInSol.mul(syncInfo.solPrice);

        if (isInputSol && isOutputToken) {
            // SOL -> TOKEN swap
            swapResult = calculateSyncSwap(
                solReserves,
                tokenReserves,
                inputAmount,
            );

            if (!swapResult) {
                return null;
            }

            // Calculate USD values
            inputUSD = inputAmount.mul(syncInfo.solPrice);
            outputUSD = swapResult.outputAmount.mul(tokenPriceInUSD);
        } else if (isInputToken && isOutputSol) {
            // TOKEN -> SOL swap
            swapResult = calculateSyncSwap(
                tokenReserves,
                solReserves,
                inputAmount,
            );

            if (!swapResult) {
                return null;
            }

            // Calculate USD values
            inputUSD = inputAmount.mul(tokenPriceInUSD);
            outputUSD = swapResult.outputAmount.mul(syncInfo.solPrice);
        } else {
            return null;
        }

        const minOutput = swapResult.outputAmount.mul(1 - slippageBps / 10_000);

        // Determine instruction name based on migration status
        const insName = syncInfo.isMigrated ? "SyncPswap" : "SyncSwap";

        return {
            input: inputAmount,
            inputUSD,
            maxInput: new Decimal(0), // Not used for ExactIn
            output: swapResult.outputAmount,
            outputUSD,
            minOutput,
            insName,
            getTransaction,
            stops: [], // Single hop swap
            priceImpactBps: swapResult.priceImpactBps,
            slippageBps,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        syncInfo,
        user,
        sync,
        tokenMint,
        inputToken.mint,
        outputToken.mint,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputAmount.toString(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        outputAmount?.toString(),
        slippageBps,
        getTransaction,
    ]);

    return quote;
}
