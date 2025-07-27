"use client";

import { useEffect, useState } from "react";
import { Quote, QuoteResult, SwapToken } from "./swapTypes";
import { PublicKey } from "@solana/web3.js";

export function useQuoteResult(
    user: PublicKey | undefined,
    inputToken: SwapToken,
    outputToken: SwapToken,
    inputAmount: number,
    outputAmount: number,
    slippageBps: number,
    refreshKey: number,
    fetchQuote: (
        user: PublicKey | undefined,
        inputToken: SwapToken,
        outputToken: SwapToken,
        inputAmount: number,
        outputAmount: number,
        slippageBps: number,
    ) => Promise<Quote>,
): QuoteResult {
    const [quoteResult, setQuoteResult] = useState<QuoteResult>({
        status: "invalid",
    });
    // Use loading state only when parameters change;
    // on regular refreshes, perform refresh transparently :)
    useEffect(() => {
        setQuoteResult({ status: "loading" });
    }, [user, inputToken, outputToken, inputAmount, outputAmount, slippageBps]);

    // Effect that runs when anything refreshes
    useEffect(() => {
        if (
            // at least 1 of inputAmount or outputAmount must be specified :)
            (!inputAmount && !outputAmount) ||
            // can't swap a token to itself!
            inputToken.mint === outputToken.mint
        ) {
            setQuoteResult({ status: "invalid" });
            return;
        }
        if (inputAmount && outputAmount) {
            setQuoteResult({
                status: "error",
                message: "can't have both input + output amount",
            });
            return;
        }
        let active = true;
        fetchQuote(
            user,
            inputToken,
            outputToken,
            inputAmount,
            outputAmount,
            slippageBps,
        )
            .then(
                (q) =>
                    active && setQuoteResult({ status: "success", quote: q }),
            )
            .catch(
                (e) =>
                    active &&
                    setQuoteResult({ status: "error", message: String(e) }),
            );
        return () => {
            active = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        slippageBps,
        refreshKey,
    ]);
    return quoteResult;
}
