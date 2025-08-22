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

// Sync protocol fee: 0.75% on all swaps
const SYNC_FEE_BPS = 75; // 0.75% fee matching sync.h

// Pump.fun fee: 1% (used in addition to Sync fees)
const PF_FEE_BPS = 100;

// Pump.fun AMM fee: 0.3%
const PA_FEE_BPS = 30;

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
    syncAddress: PublicKey;
    tokenMint: PublicKey;
    pumpMint: PublicKey;
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
function useSyncCurve(pumpMint: PublicKey | null) {
    const [syncCurve, setSyncCurve] = useState<SyncCurve | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!pumpMint) {
            setSyncCurve(null);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        const fetchCurve = async () => {
            try {
                const bondingCurve = SyncCurve.deriveBondingCurve(pumpMint);

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
                    pumpMint,
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
    }, [pumpMint?.toBase58()]);

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
// Note: Sync fee is applied on top of protocol fees
function calculateSyncSwap(
    inputReserves: Decimal,
    outputReserves: Decimal,
    inputAmount: Decimal,
    isBuy: boolean,
    protocolFeeBps: number, // Pass in either PF_FEE_BPS or PA_FEE_BPS
): {
    outputAmount: Decimal;
    priceImpactBps: number;
} | null {
    if (
        inputAmount.isZero() ||
        inputReserves.isZero() ||
        outputReserves.isZero()
    ) {
        return {
            outputAmount: new Decimal(0),
            priceImpactBps: 0,
        };
    }

    // Calculate initial price for price impact
    const initialPrice = inputReserves.div(outputReserves);

    let amountAfterAllFees: Decimal;

    if (isBuy) {
        // For buys: Sync fee is taken from SOL input first
        const syncFeeAmount = inputAmount.mul(SYNC_FEE_BPS).div(10_000);
        const amountAfterSyncFee = inputAmount.sub(syncFeeAmount);

        // Then protocol fee is applied (Pump.fun or PumpSwap AMM)
        const protocolFeeAmount = amountAfterSyncFee
            .mul(protocolFeeBps)
            .div(10_000);
        amountAfterAllFees = amountAfterSyncFee.sub(protocolFeeAmount);
    } else {
        // For sells: Only protocol fee is applied to the swap
        // Sync fee will be taken from the SOL output after the swap
        const protocolFeeAmount = inputAmount.mul(protocolFeeBps).div(10_000);
        amountAfterAllFees = inputAmount.sub(protocolFeeAmount);
    }

    if (amountAfterAllFees.lte(0)) {
        return null;
    }

    // Use Curve.swapBaseInput for the constant product calculation
    const outputAmount = Curve.swapBaseInput(
        amountAfterAllFees,
        inputReserves,
        outputReserves,
    );

    if (!outputAmount || outputAmount.lte(0)) {
        return null;
    }

    // For sells, calculate Sync fee from SOL output
    let finalOutputAmount = outputAmount;
    if (!isBuy) {
        const syncFeeAmount = outputAmount.mul(SYNC_FEE_BPS).div(10_000);
        finalOutputAmount = outputAmount.sub(syncFeeAmount);
    }

    // Calculate new reserves for price impact
    const newInputReserves = inputReserves.add(amountAfterAllFees);
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
        outputAmount: finalOutputAmount,
        priceImpactBps,
    };
}

export function useSyncQuote({
    user,
    syncInfo,
    tokenMint,
    syncAddress,
    pumpMint,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    slippageBps,
}: SyncQuoteParams): Quote | null {
    // Fetch blockchain state objects
    const { syncGlobal } = useSyncGlobal();
    const { syncCurve } = useSyncCurve(!syncInfo?.isMigrated ? pumpMint : null);
    const { syncPool } = useSyncPool(syncInfo?.pswapPool || null);

    // Create transaction getter
    const getTransaction = useCallback(
        async (minOutput: Decimal): Promise<Transaction> => {
            if (!syncInfo || !user || !syncGlobal) {
                throw new Error("Missing required data for transaction");
            }

            const tx = new Transaction();

            const inputAmountRaw = BigInt(
                inputAmount.mul(Math.pow(10, inputToken.decimals)).toFixed(0),
            );
            const minOutputRaw = BigInt(
                minOutput.mul(Math.pow(10, outputToken.decimals)).toFixed(0),
            );

            const isInputSol = inputToken.mint === WSOL_MINT_B58;
            const isBuy = isInputSol; // Buy = SOL -> Token, Sell = Token -> SOL

            if (!syncInfo.isMigrated) {
                // Use bonding curve swap
                if (!syncCurve) {
                    throw new Error("Bonding curve data not available");
                }

                const instruction = await Sync.swap(
                    syncAddress,
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

                const instruction = await Sync.pswap(
                    syncAddress,
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
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            user,
            syncAddress,
            syncGlobal,
            syncCurve,
            syncPool,
            syncInfo?.isMigrated,
            inputToken.mint,
            // eslint-disable-next-line react-hooks/exhaustive-deps
            inputAmount.toString(),
            inputToken.decimals,
            outputToken.decimals,
            slippageBps,
        ],
    );

    const quote = useMemo(() => {
        // Validate inputs
        if (!syncInfo || inputAmount.isZero() || !syncAddress) {
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

        // Determine which protocol fee to use
        const protocolFeeBps = syncInfo.isMigrated ? PA_FEE_BPS : PF_FEE_BPS;

        if (isInputSol && isOutputToken) {
            // SOL -> TOKEN swap (Buy)
            swapResult = calculateSyncSwap(
                solReserves,
                tokenReserves,
                inputAmount,
                true, // isBuy
                protocolFeeBps, // Pass the appropriate fee
            );

            if (!swapResult) {
                return null;
            }

            // Calculate USD values
            inputUSD = inputAmount.mul(syncInfo.solPrice);
            outputUSD = swapResult.outputAmount.mul(tokenPriceInUSD);
        } else if (isInputToken && isOutputSol) {
            // TOKEN -> SOL swap (Sell)
            swapResult = calculateSyncSwap(
                tokenReserves,
                solReserves,
                inputAmount,
                false, // isBuy (sell)
                protocolFeeBps, // Pass the appropriate fee
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
            getTransaction: () => getTransaction(minOutput),
            stops: [], // Single hop swap
            priceImpactBps: swapResult.priceImpactBps,
            slippageBps,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        syncInfo,
        user,
        syncAddress,
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
