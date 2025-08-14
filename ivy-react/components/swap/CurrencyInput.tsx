import { SwapToken } from "./swapTypes";
import { Button } from "@/components/ui/button";
import { cn, sfcap } from "@/lib/utils";
import { Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DecimalInput } from "./DecimalInput";
import { TokenSelect } from "./TokenSelect";
import { Decimal } from "decimal.js-light";
import { useCallback, useEffect, useState } from "react";
import { MAX_SF } from "@/lib/constants";

type CurrencyInputProps = {
    title?: string;
    amount: Decimal | undefined;
    dollarValue: number;
    balance: Decimal | undefined;
    onChange: (value: Decimal) => void;
    onTokenSelect: () => void;
    token: SwapToken;
    className?: string;
    isTokenSelectDisabled?: boolean;
    isDisabled?: boolean;
    hideBalance?: boolean;
    switchKey: number;
    maxAmount?: Decimal | undefined;
};

export function CurrencyInput({
    title,
    amount,
    dollarValue,
    balance,
    onChange,
    onTokenSelect,
    token,
    className,
    isTokenSelectDisabled = false,
    isDisabled = false,
    hideBalance = false,
    switchKey,
    maxAmount,
}: CurrencyInputProps) {
    const [displayOverride, setDisplayOverride] = useState<string | undefined>(
        undefined,
    );

    // Clear override on token switch
    useEffect(() => {
        setDisplayOverride(undefined);
    }, [switchKey]);

    // Clear override when user types
    const handleChange = useCallback(
        (value: Decimal) => {
            setDisplayOverride(undefined);
            onChange(value);
        },
        [onChange],
    );

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
                    {amount === undefined ? (
                        <Skeleton className="h-10 w-3/4 rounded-none border-2 border-zinc-700" />
                    ) : (
                        <DecimalInput
                            className="w-full bg-transparent border-none text-4xl font-medium text-white p-0 focus-visible:ring-0 focus-visible:outline-none"
                            value={amount}
                            onValueChange={handleChange}
                            disabled={isDisabled}
                            unselectable={isDisabled}
                            displayOverride={displayOverride}
                        />
                    )}
                </div>
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
                            {balance === undefined ? (
                                <Skeleton className="h-3 w-10 rounded-none border border-zinc-700" />
                            ) : (
                                balance.toFixed(4)
                            )}
                        </div>
                        {!isDisabled && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 px-2 text-xs rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold transition-none"
                                onClick={() => {
                                    if (!maxAmount) {
                                        return;
                                    }

                                    // Set the display to truncated version
                                    setDisplayOverride(
                                        sfcap(
                                            maxAmount.toNumber(),
                                            MAX_SF,
                                        ).toString(),
                                    );

                                    // Set the actual value to full amount
                                    onChange(maxAmount);
                                }}
                                disabled={balance === undefined}
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
