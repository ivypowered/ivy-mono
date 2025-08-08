"use client";
import { Clock, CheckCircle2 } from "lucide-react";
import { useSwap } from "./SwapProvider";

export function SwapSuccessView() {
    const { txHash, txSeconds, dismissSuccess } = useSwap();

    return (
        <div className="bg-zinc-900 text-white h-full flex flex-col">
            {/* Main content area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 min-h-[200px]">
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
            </div>

            {/* Footer section */}
            <div className="border-t-4 border-emerald-400 p-4 space-y-4">
                {/* Transaction info line */}
                <div className="w-full flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>{txSeconds} seconds</span>
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
