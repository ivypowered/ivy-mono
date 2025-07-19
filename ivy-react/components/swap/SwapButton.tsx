import { Button } from "@/components/ui/button";
import { useSwap } from "./SwapProvider";
import { Btn } from "./swapTypes";

export function SwapButton() {
    const { btn, executeSwap, inputToken, connectWallet } = useSwap();

    return (
        <Button
            className="mt-4 w-full h-12 rounded-none border-2 text-base font-bold transition-none border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
            onClick={() => {
                switch (btn) {
                    case Btn.ConnectWallet:
                        connectWallet();
                        break;
                    case Btn.ReadyToSwap:
                        executeSwap();
                        break;
                }
            }}
            disabled={[
                Btn.Loading,
                Btn.SwapRetrieving,
                Btn.SwapSigning,
                Btn.SwapSending,
                Btn.SwapConfirming,
                Btn.InsufficientBalance,
                Btn.QuoteError,
                Btn.EnterAnAmount,
            ].includes(btn)}
        >
            {(() => {
                switch (btn) {
                    case Btn.ConnectWallet:
                        return "connect wallet";
                    case Btn.EnterAnAmount:
                        return "enter an amount";
                    case Btn.Loading:
                        return "loading";
                    case Btn.SwapRetrieving:
                        return "retrieving";
                    case Btn.SwapSigning:
                        return "signing";
                    case Btn.SwapSending:
                        return "sending";
                    case Btn.SwapConfirming:
                        return "confirming";
                    case Btn.InsufficientBalance:
                        return `insufficient ${inputToken.symbol}`;
                    case Btn.QuoteError:
                        return "quote error";
                    case Btn.ReadyToSwap:
                        return "swap";
                    default:
                        return "unknown";
                }
            })()}
        </Button>
    );
}
