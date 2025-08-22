"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Quote, QuoteResult, SwapToken } from "./swapTypes";
import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js-light";
import {
    useQuote,
    GameReserves,
    WorldReserves,
    FeeConfig,
} from "@/lib/useQuote";
import { SyncQuoteInfo, useSyncQuote } from "@/lib/useSyncQuote";

// Instant updates feel jarring
const MIN_DELAY_MS = 150;
const MAX_DELAY_MS = 300;

export type QuoteContext =
    | {
          game: PublicKey;
          gameSwapAlt: PublicKey;
          gameMint: string;
          gameReserves: GameReserves | null;
          worldReserves: WorldReserves | null;
          feeConfig: FeeConfig | null;
          isSync: false;
      }
    | {
          syncInfo: SyncQuoteInfo | null;
          tokenMint: PublicKey;
          pumpMint: PublicKey;
          syncAddress: PublicKey;
          isSync: true;
      };

export function useQuoteResult(
    user: PublicKey | undefined,
    inputToken: SwapToken,
    outputToken: SwapToken,
    inputAmount: Decimal,
    outputAmount: Decimal,
    slippageBps: number,
    refreshKey: number,
    context: QuoteContext,
): QuoteResult {
    const initialIsSync = useRef<boolean>(context.isSync);
    if (initialIsSync.current !== context.isSync) {
        throw new Error(
            "react rules of hooks: can't switch whether context is `isSync`",
        );
    }

    // Get quote from useQuote hook
    let quote: Quote | null;
    if (context.isSync) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        quote = useSyncQuote({
            user,
            inputToken,
            outputToken,
            inputAmount,
            outputAmount,
            slippageBps,
            tokenMint: context.tokenMint,
            syncInfo: context.syncInfo,
            syncAddress: context.syncAddress,
            pumpMint: context.pumpMint,
        });
    } else {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        quote = useQuote({
            user,
            game: context.game,
            gameSwapAlt: context.gameSwapAlt,
            gameMint: context.gameMint,
            inputToken,
            outputToken,
            inputAmount,
            outputAmount,
            slippageBps,
            gameReserves: context.gameReserves,
            worldReserves: context.worldReserves,
            feeConfig: context.feeConfig,
            refreshKey,
        });
    }

    const [cachedQuote, setCachedQuote] = useState<Quote | null>(null);
    const [mustLoad, setMustLoad] = useState<boolean>(false);
    const mlRound = useRef<number>(0);

    // Clear cache when parameters change to trigger loading state
    useEffect(() => {
        setCachedQuote(null);
        setMustLoad(true);
        const r = ++mlRound.current;
        const delay =
            MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
        setTimeout(() => {
            if (mlRound.current !== r) {
                return;
            }
            setMustLoad(false);
        }, delay);
    }, [user, inputToken, outputToken, inputAmount, outputAmount, slippageBps]);

    // Update cache when we get a new quote
    useEffect(() => {
        if (quote) {
            setCachedQuote(quote);
        }
    }, [quote]);

    // Determine the result based on validation and quote/cache
    const quoteResult: QuoteResult = useMemo(() => {
        // Validation checks
        if (
            // at least 1 of inputAmount or outputAmount must be specified :)
            (inputAmount.isZero() && outputAmount.isZero()) ||
            // can't swap a token to itself!
            inputToken.mint === outputToken.mint
        ) {
            return { status: "invalid" };
        }

        if (!inputAmount.isZero() && !outputAmount.isZero()) {
            return {
                status: "error",
                message: "can't have both input + output amount",
            };
        }

        if (!mustLoad && cachedQuote) {
            return { status: "success", quote: cachedQuote };
        }

        // No quote and no cache means we're loading
        return { status: "loading" };
    }, [
        cachedQuote,
        inputAmount,
        inputToken.mint,
        outputAmount,
        outputToken.mint,
        mustLoad,
    ]);

    return quoteResult;
}
