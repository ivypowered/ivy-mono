import { CurrencyInput } from "./CurrencyInput";
import { useSwap } from "./SwapProvider";
import { Selector } from "./swapTypes";
import { sfcap } from "@/lib/utils";
import { MAX_SF } from "@/lib/constants";
import { ArrowDown } from "lucide-react";

export function SwapInput() {
    const {
        inputToken,
        outputToken,
        inputAmount,
        outputAmount,
        inputFixed,
        outputFixed,
        quote,
        inBalance,
        outBalance,
        switchTokens,
        setInputAmount,
        setOutputAmount,
        openTokenSelector,
        connected,
    } = useSwap();

    return (
        <>
            <CurrencyInput
                title="You pay"
                amount={inputAmount}
                dollarValue={quote?.inputUSD || 0}
                onChange={setInputAmount}
                token={inputToken}
                onTokenSelect={() => openTokenSelector(Selector.Input)}
                maxAmount={inBalance}
                onMax={(v) => setInputAmount(sfcap(v, MAX_SF))}
                hideBalance={!connected}
                isTokenSelectDisabled={inputFixed}
                isDisabled={false}
            />

            <div className="relative">
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pt-2">
                    <button
                        onClick={switchTokens}
                        className="rounded-none border-4 border-emerald-400 bg-zinc-900 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2"
                    >
                        <ArrowDown className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <CurrencyInput
                title="You receive"
                amount={outputAmount}
                dollarValue={quote?.outputUSD || 0}
                onChange={setOutputAmount}
                token={outputToken}
                onTokenSelect={() => openTokenSelector(Selector.Output)}
                className="mt-2"
                maxAmount={outBalance}
                hideBalance={!connected}
                isTokenSelectDisabled={outputFixed}
                isDisabled={true}
                onMax={(v) => setOutputAmount(sfcap(v, MAX_SF))}
            />
        </>
    );
}
