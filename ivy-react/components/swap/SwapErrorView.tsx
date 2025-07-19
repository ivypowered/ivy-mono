"use client";

import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { useSwap } from "./SwapProvider";

export function SwapErrorView() {
    const [isErrorExpanded, setIsErrorExpanded] = useState(false);
    const { errorDetails, dismissError } = useSwap();
    useEffect(() => {
        setIsErrorExpanded(false);
    }, [errorDetails]);

    return (
        <div className="bg-zinc-900 text-white h-full flex flex-col">
            {/* Main content area */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6 min-h-[250px]">
                {/* Error Icon */}
                <div>
                    <AlertTriangle
                        className="h-16 w-16 text-red-400"
                        strokeWidth={2}
                    />
                </div>

                {/* Title */}
                <h2 className="text-xl font-bold text-center">
                    Something went wrong
                </h2>

                {/* Helpful message for the user */}
                <div className="border-2 border-red-400 p-4 w-full">
                    <p className="text-center">
                        Try swapping again in a few moments.
                    </p>
                </div>
            </div>

            {/* Footer section */}
            <div className="border-t-4 border-red-400 p-4 space-y-4">
                {/* Error details toggle */}
                <div className="w-full">
                    <button
                        onClick={() => setIsErrorExpanded(!isErrorExpanded)}
                        className="flex items-center gap-2 text-sm hover:text-red-400 transition-colors"
                    >
                        <Info className="h-4 w-4" />
                        Error details
                        <ChevronDown
                            className={`h-4 w-4 ${isErrorExpanded ? "rotate-180" : ""}`}
                        />
                    </button>
                    <div
                        className={`overflow-hidden ${
                            isErrorExpanded ? "h-[150px]" : "h-0"
                        }`}
                    >
                        <div className="text-sm text-zinc-400 max-h-[142px] overflow-y-auto pr-2 mt-2 border-2 border-zinc-700 p-2">
                            {errorDetails}
                        </div>
                    </div>
                </div>

                {/* Close Button */}
                <button
                    className="w-full rounded-none bg-red-400 text-zinc-950 hover:bg-red-300 font-bold px-4 py-2 text-base"
                    onClick={dismissError}
                >
                    dismiss
                </button>
            </div>
        </div>
    );
}
