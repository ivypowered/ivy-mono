"use client";
import { Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { useSwap } from "./SwapProvider";
import { sfcap } from "@/lib/utils";
import { MAX_SF } from "@/lib/constants";

export function SwapSuccessView() {
    const {
        inputToken,
        outputToken,
        txInput,
        txOutput,
        txHash,
        txSeconds,
        dismissSuccess,
    } = useSwap();

    return (
        <div className="bg-zinc-900 text-white h-full flex flex-col">
            {/* Main content area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 min-h-[250px]">
                {/* Success Icon */}
                <div>
                    <CheckCircle2
                        className="h-16 w-16 text-emerald-400"
                        strokeWidth={2}
                    />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-center">
                    Swap successful
                </h2>

                {/* Token swap details */}
                <div className="p-4 w-full">
                    <div className="flex items-center justify-center gap-2 text-sm sm:text-base">
                        {/* From token - smaller font but same precision */}
                        <div className="flex items-center justify-center shrink-0">
                            <img
                                src={inputToken.icon || "/placeholder.svg"}
                                alt={inputToken.symbol}
                                width={24}
                                height={24}
                                className="object-contain rounded-full mr-2"
                            />
                            <span>
                                {sfcap(txInput, MAX_SF)} {inputToken.symbol}
                            </span>
                        </div>

                        {/* Arrow indicator with compact spacing */}
                        <div className="text-emerald-400 flex items-center justify-center">
                            <ArrowRight className="w-5 h-5 mx-1" />
                        </div>

                        {/* To token - smaller font but same precision */}
                        <div className="flex items-center justify-center shrink-0">
                            <img
                                src={outputToken.icon}
                                alt={outputToken.symbol}
                                width={24}
                                height={24}
                                className="object-contain rounded-full mr-2"
                            />
                            <span>
                                {sfcap(txOutput, MAX_SF)} {outputToken.symbol}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer section */}
            <div className="border-t-4 border-emerald-400 p-4 space-y-4">
                {/* Transaction info line */}
                <div className="w-full flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{txSeconds.toFixed(1)} seconds</span>
                    </div>
                    <a
                        href={`https://solscan.io/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                    >
                        View on Solscan
                    </a>
                </div>

                {/* Close Button */}
                <button
                    className="w-full rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-2 text-base"
                    onClick={dismissSuccess}
                >
                    close
                </button>
            </div>
        </div>
    );
}
