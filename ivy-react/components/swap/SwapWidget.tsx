import { SwapTokenSelector } from "./SwapTokenSelector";
import { useSwap } from "./SwapProvider";
import { SwapSuccessView } from "./SwapSuccessView";
import { SwapErrorView } from "./SwapErrorView";
import { SwapInput } from "./SwapInput";
import { SwapButton } from "./SwapButton";
import { SwapInfo } from "./SwapInfo";
import { BaseDialog } from "../ui/base-dialog";
import { Selector } from "./swapTypes";

export function SwapWidget({ children }: { children?: React.ReactNode }) {
    const { selector, isSuccessOpen, isFailedOpen } = useSwap();

    return (
        <>
            <div className="flex flex-col items-center w-full lg:col-span-4">
                <div className="w-full">
                    <SwapInput />
                    <SwapButton />
                    <SwapInfo />
                    {children}
                </div>
            </div>

            {/* Dialogs */}
            <BaseDialog open={selector !== Selector.None}>
                <SwapTokenSelector />
            </BaseDialog>

            <BaseDialog open={isSuccessOpen}>
                <SwapSuccessView />
            </BaseDialog>

            <BaseDialog open={isFailedOpen} className="border-red-400">
                <SwapErrorView />
            </BaseDialog>
        </>
    );
}
