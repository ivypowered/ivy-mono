import { SwapToken } from "./swapTypes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DecimalInput } from "./DecimalInput";
import { TokenSelect } from "./TokenSelect";

type CurrencyInputProps = {
    title?: string;
    amount: number | undefined;
    dollarValue: number;
    maxAmount: number | undefined;
    onChange: (value: number) => void;
    onMax: (value: number) => void;
    onTokenSelect: () => void;
    token: SwapToken;
    className?: string;
    isTokenSelectDisabled?: boolean;
    isDisabled?: boolean;
    hideBalance?: boolean;
};

export function CurrencyInput({
    title,
    amount,
    dollarValue,
    maxAmount,
    onChange,
    onMax,
    onTokenSelect,
    token,
    className,
    isTokenSelectDisabled = false,
    isDisabled = false,
    hideBalance = false,
}: CurrencyInputProps) {
    return (
        <div
            className={cn(
                "p-4 bg-zinc-900 rounded-none shadow-lg border-4 border-emerald-400",
                className,
            )}
        >
            {title && (
                <div className="text-sm text-emerald-400 mb-2 font-bold">
                    {title}
                </div>
            )}
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                    {/* Inlined renderAmountInput */}
                    {amount === undefined ? (
                        <Skeleton className="h-10 w-3/4 rounded-none border-2 border-zinc-700" />
                    ) : (
                        <DecimalInput
                            className="w-full bg-transparent border-none text-4xl font-medium text-white p-0 focus-visible:ring-0 focus-visible:outline-none"
                            value={amount}
                            onValueChange={onChange}
                            disabled={isDisabled}
                            unselectable={isDisabled}
                        />
                    )}
                </div>
                {/* Inlined renderTokenSelector */}
                <TokenSelect
                    onTokenSelect={onTokenSelect}
                    token={token}
                    isDisabled={isTokenSelectDisabled}
                />
            </div>
            <div className="flex justify-between items-center text-sm text-zinc-400 mt-2">
                <div className="text-emerald-400">
                    ${dollarValue.toFixed(2)}
                </div>
                {!hideBalance && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center text-sm">
                            <Wallet className="h-3 w-3 mr-1 text-emerald-400" />
                            {maxAmount === undefined ? (
                                <Skeleton className="h-3 w-10 rounded-none border border-zinc-700" />
                            ) : (
                                maxAmount.toFixed(4)
                            )}
                        </div>
                        {!isDisabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold transition-none"
                                onClick={() => onMax(maxAmount ?? 0)}
                                disabled={maxAmount === undefined}
                            >
                                Max
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
