"use client";

import { cn } from "@/lib/utils";
import { ArrowRightLeft, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useSwap } from "./SwapProvider";
import { ActiveSide } from "./swapTypes";
import { SlippageDialog } from "./SlippageDialog";

export function SwapInfo() {
    const [infoOpen, setInfoOpen] = useState(false);
    const [isReversed, setIsReversed] = useState(false);
    const { quote, inputToken, outputToken, activeSide, setSlippageBps } =
        useSwap();

    const [slippageOpen, setSlippageOpen] = useState(false);

    useEffect(() => {
        if (!quote) {
            setInfoOpen(false);
        }
    }, [quote]);

    const rate = quote ? quote.output.toNumber() / quote.input.toNumber() : 0;

    return (
        <>
            <SlippageDialog
                open={slippageOpen}
                onClose={() => setSlippageOpen(false)}
                currentSlippageBps={quote?.slippageBps || 100}
                onSave={setSlippageBps}
            />

            <div className={`overflow-hidden ${quote ? "mt-2" : "h-0 mt-0"}`}>
                <div className="flex items-center justify-between">
                    <span
                        className="text-xs text-zinc-400 flex items-center cursor-pointer hover:text-emerald-400 select-text"
                        onClick={() => setIsReversed(!isReversed)}
                        onMouseDown={(e) => {
                            // Prevent selection on double click
                            if (e.detail > 1) {
                                e.preventDefault();
                            }
                        }}
                    >
                        {isReversed ? (
                            <>
                                1 {outputToken.symbol} ≈ {(1 / rate).toFixed(6)}{" "}
                                {inputToken.symbol}
                            </>
                        ) : (
                            <>
                                1 {inputToken.symbol} ≈ {rate.toFixed(6)}{" "}
                                {outputToken.symbol}
                            </>
                        )}
                        <ArrowRightLeft className="ml-2 h-3 w-3" />
                    </span>
                    <button
                        className="p-1 text-zinc-400 hover:text-emerald-400 border border-transparent hover:border-emerald-400"
                        onClick={() => setInfoOpen((v) => !v)}
                    >
                        <ChevronDown
                            className={cn("h-4 w-4", {
                                "rotate-180": infoOpen,
                            })}
                        />
                    </button>
                </div>
            </div>
            <div
                className="space-y-2 text-xs overflow-hidden"
                style={{
                    height: infoOpen ? "auto" : "0px",
                    opacity: infoOpen ? 1 : 0,
                    marginTop: infoOpen ? "1rem" : "0",
                }}
            >
                {quote && (
                    <>
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400">
                                    {activeSide === ActiveSide.Input
                                        ? "Minimum received"
                                        : "Maximum consumed"}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-300">
                                    {(activeSide === ActiveSide.Input
                                        ? quote.minOutput
                                        : quote.maxInput
                                    ).toFixed(6)}{" "}
                                    {
                                        (activeSide === ActiveSide.Input
                                            ? outputToken
                                            : inputToken
                                        ).symbol
                                    }
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400">
                                    Price impact
                                </span>
                            </div>
                            <span className="text-zinc-300">
                                ≈ {(quote.priceImpactBps / 100).toFixed(2)}%
                            </span>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-zinc-400">
                                    Max slippage
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSlippageOpen(true)}
                                    className="bg-zinc-900 text-emerald-400 border border-emerald-400 px-1 font-bold hover:text-zinc-900 hover:bg-emerald-400"
                                >
                                    edit
                                </button>
                                <span className="text-zinc-300 ml-2">
                                    {(quote.slippageBps / 100).toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}
