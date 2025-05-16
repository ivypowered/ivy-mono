"use client";

import type { SwapToken } from "./swapTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

type TokenSelectProps = {
    onTokenSelect: () => void;
    token: SwapToken;
    className?: string;
    isDisabled?: boolean;
};

export function TokenSelect({
    onTokenSelect,
    token,
    className,
    isDisabled,
}: TokenSelectProps) {
    return (
        <Button
            variant="outline"
            className={cn(
                "px-2 flex items-center rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold h-10 transition-none",
                isDisabled &&
                    "border-dashed cursor-default bg-background hover:bg-background hover:text-emerald-400 pr-3",
                className,
            )}
            onClick={isDisabled ? undefined : onTokenSelect}
        >
            <img
                src={token.icon || "/placeholder.svg"}
                alt={token.name}
                width={24}
                height={24}
                className="rounded-full"
            />
            <span className="text-[16px]">{token.symbol}</span>
            {!isDisabled && <ChevronDown className="w-5 h-5" />}
        </Button>
    );
}
