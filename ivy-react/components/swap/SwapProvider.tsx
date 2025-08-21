import {
    createContext,
    useContext,
    ReactNode,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import {
    PROCESS_TRANSACTION_CONFIRMING,
    PROCESS_TRANSACTION_RETRIEVING,
    PROCESS_TRANSACTION_SENDING,
    PROCESS_TRANSACTION_SIGNING,
    processTransaction,
    sfcap,
} from "@/lib/utils";
import {
    SwapToken,
    SwapState,
    SwapContextValue,
    ActiveSide,
    Selector,
    Btn,
    Quote,
} from "./swapTypes";
import {
    DECIMAL_ZERO,
    DEFAULT_SLIPPAGE_BPS,
    MAX_SF,
    WSOL_MINT_B58,
} from "@/lib/constants";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { QuoteContext, useQuoteResult } from "./QuoteProvider";
import { useBalance } from "./BalanceProvider";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Api } from "@/lib/api";
import Decimal from "decimal.js-light";

const SwapContext = createContext<SwapContextValue | undefined>(undefined);

interface SwapProviderProps {
    children: ReactNode;
    commonTokens: SwapToken[];
    connectWallet: () => void;
    fetchBalance: (user: PublicKey, token: SwapToken) => Promise<Decimal>;
    initialInputToken: SwapToken;
    initialOutputToken: SwapToken;
    quoteContext: QuoteContext;
    reloadBalances: () => void;
    signTransaction: (
        tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>;
    tokens: SwapToken[] | undefined;
    user: PublicKey | undefined;
    updateBalanceRef: {
        current: ((mint: string, amount: Decimal) => void) | null;
    };
}

const REFRESH_MS = 15_000;

export function SwapProvider({
    children,
    commonTokens,
    connectWallet,
    fetchBalance,
    initialInputToken,
    initialOutputToken,
    quoteContext,
    reloadBalances,
    signTransaction,
    tokens,
    user,
    updateBalanceRef,
}: SwapProviderProps) {
    const [state, setState] = useState<SwapState>(() => ({
        inputToken: initialInputToken,
        outputToken: initialOutputToken,
        inputFixed: false,
        outputFixed: true,
        inputAmount: DECIMAL_ZERO,
        outputAmount: DECIMAL_ZERO,
        switchKey: 0,
        activeSide: ActiveSide.Input,
        slippageBps: DEFAULT_SLIPPAGE_BPS,

        isSuccessOpen: false,
        isFailedOpen: false,
        btn: user ? Btn.EnterAnAmount : Btn.ConnectWallet,
        selector: Selector.None,

        txHash: "",
        txInput: 0,
        txOutput: 0,
        errorDetails: "",
        txSeconds: 0,
    }));

    // output is fixed, so we should update with initial output token :)
    useEffect(() => {
        setState((s) => ({ ...s, outputToken: initialOutputToken }));
    }, [initialOutputToken]);

    // Set up a refresh key that auto-increments every 15 seconds
    const [refreshKey, setRefreshKey] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setRefreshKey((k) => k + 1), REFRESH_MS);
        return () => clearInterval(id);
    }, []);

    const [balanceReloadKey, setBalanceReloadKey] = useState<number>(0);
    const [inBalance, setInBalance] = useBalance(
        user,
        state.inputToken,
        refreshKey,
        balanceReloadKey,
        fetchBalance,
    );
    const [outBalance, setOutBalance] = useBalance(
        user,
        state.outputToken,
        refreshKey,
        balanceReloadKey,
        fetchBalance,
    );

    const quoteResult = useQuoteResult(
        // jupiter API does not support amount > balance
        (state.activeSide === ActiveSide.Input &&
            state.inputAmount &&
            inBalance &&
            state.inputAmount.gt(inBalance)) ||
            (state.activeSide === ActiveSide.Output &&
                state.outputAmount &&
                outBalance &&
                state.outputAmount.gt(outBalance))
            ? undefined
            : user,
        state.inputToken,
        state.outputToken,
        state.activeSide === ActiveSide.Input
            ? state.inputAmount || DECIMAL_ZERO
            : DECIMAL_ZERO,
        state.activeSide === ActiveSide.Output
            ? state.outputAmount || DECIMAL_ZERO
            : DECIMAL_ZERO,
        state.slippageBps,
        refreshKey,
        quoteContext,
    );

    const isTiny = useMediaQuery("(max-width: 359px)");

    useEffect(() => {
        switch (quoteResult.status) {
            case "error":
                console.error("can't get quote:", quoteResult.message);
            case "loading":
                setState((prev) => {
                    if (prev.activeSide === ActiveSide.Input) {
                        return {
                            ...prev,
                            outputAmount:
                                prev.inputAmount && !prev.inputAmount.isZero()
                                    ? undefined
                                    : DECIMAL_ZERO,
                        };
                    } else {
                        return {
                            ...prev,
                            inputAmount:
                                prev.outputAmount && !prev.outputAmount.isZero()
                                    ? undefined
                                    : DECIMAL_ZERO,
                        };
                    }
                });
                break;
            case "success":
                const quote = quoteResult.quote;
                setState((prev) => {
                    if (prev.activeSide === ActiveSide.Input) {
                        return {
                            ...prev,
                            outputAmount: new Decimal(
                                sfcap(
                                    quote.output.toNumber(),
                                    isTiny ? 6 : MAX_SF,
                                ),
                            ),
                        };
                    } else {
                        return {
                            ...prev,
                            inputAmount: new Decimal(
                                sfcap(
                                    quote.input.toNumber(),
                                    isTiny ? 6 : MAX_SF,
                                ),
                            ),
                        };
                    }
                });
                break;
            case "invalid":
                setState((prev) => {
                    if (prev.activeSide === ActiveSide.Input) {
                        return {
                            ...prev,
                            outputAmount: DECIMAL_ZERO,
                        };
                    } else {
                        return {
                            ...prev,
                            inputAmount: DECIMAL_ZERO,
                        };
                    }
                });
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteResult]);

    useEffect(() => {
        updateBalanceRef.current = (mint: string, amount: Decimal) => {
            if (state.inputToken.mint === mint) {
                setInBalance(amount);
            } else if (state.outputToken.mint === mint) {
                setOutBalance(amount);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.inputToken.mint, state.outputToken.mint, updateBalanceRef]);

    const [swapState, setSwapState] = useState<
        "none" | "retrieving" | "signing" | "sending" | "confirming"
    >("none");

    useEffect(() => {
        const newBtn = (() => {
            if (swapState === "retrieving") {
                return Btn.SwapRetrieving;
            }
            if (swapState === "signing") {
                return Btn.SwapSigning;
            }
            if (swapState === "sending") {
                return Btn.SwapSending;
            }
            if (swapState === "confirming") {
                return Btn.SwapConfirming;
            }
            if (quoteResult.status === "error") {
                return Btn.QuoteError;
            }
            if (!user) {
                return Btn.ConnectWallet;
            }
            if (!state.inputAmount || state.inputAmount.isZero()) {
                return Btn.EnterAnAmount;
            }
            if (quoteResult.status === "loading") {
                return Btn.Loading;
            }
            if (inBalance && state.inputAmount.gt(inBalance)) {
                return Btn.InsufficientBalance;
            }
            return Btn.ReadyToSwap;
        })();

        if (newBtn !== state.btn) {
            setState((prev) => ({
                ...prev,
                btn: newBtn,
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        quoteResult.status,
        state.inputAmount,
        state.outputAmount,
        inBalance,
        swapState,
    ]);

    const switchTokens = useCallback(() => {
        setState((prev) => ({
            ...prev,
            inputToken: prev.outputToken,
            outputToken: prev.inputToken,
            inputFixed: prev.outputFixed,
            outputFixed: prev.inputFixed,
            inputAmount:
                prev.activeSide === ActiveSide.Input
                    ? prev.outputAmount || DECIMAL_ZERO
                    : undefined,
            outputAmount:
                prev.activeSide === ActiveSide.Output
                    ? prev.inputAmount || DECIMAL_ZERO
                    : undefined,
            switchKey: prev.switchKey + 1,
        }));
    }, []);

    const setInputAmount = useCallback((amount: Decimal) => {
        setState((prev) => {
            // Do the check inside setState to avoid dependency
            if (prev.inputAmount && amount.equals(prev.inputAmount)) {
                return prev;
            }
            return {
                ...prev,
                inputAmount: amount,
                activeSide: ActiveSide.Input,
            };
        });
    }, []);

    const setOutputAmount = useCallback((amount: Decimal) => {
        setState((prev) => {
            if (prev.outputAmount && amount.equals(prev.outputAmount)) {
                return prev;
            }
            return {
                ...prev,
                outputAmount: amount,
                activeSide: ActiveSide.Output,
            };
        });
    }, []);

    const selectToken = useCallback(
        (token: SwapToken) => {
            // prohibit input token == output token
            if (
                state.selector === Selector.Input &&
                state.outputToken.mint === token.mint
            ) {
                return;
            }
            if (
                state.selector === Selector.Output &&
                state.inputToken.mint === token.mint
            ) {
                return;
            }
            setState((prev) => ({
                ...prev,
                inputToken:
                    prev.selector === Selector.Input ? token : prev.inputToken,
                outputToken:
                    prev.selector === Selector.Output
                        ? token
                        : prev.outputToken,
                selector: Selector.None,
            }));
        },
        [state.inputToken.mint, state.outputToken.mint, state.selector],
    );

    const setSlippageBps = useCallback(
        (bps: number) =>
            setState((s) => ({
                ...s,
                slippageBps: bps,
            })),
        [],
    );

    const maxInputAmount: Decimal | undefined = useMemo(() => {
        if (
            inBalance === undefined ||
            state.inputToken.mint !== WSOL_MINT_B58
        ) {
            return inBalance;
        }
        // Solana, we want to keep at least 0.01 SOL
        // to cover network fees + ATA creation
        const mia = inBalance.minus(0.01);
        const zero = DECIMAL_ZERO;
        if (mia.lte(zero)) {
            return zero;
        }
        return mia;
    }, [inBalance, state.inputToken]);

    let quote: Quote | undefined;
    if (quoteResult.status === "success") {
        quote = quoteResult.quote;
    }
    let quoteError = "";
    if (quoteResult.status === "error") {
        quoteError = quoteResult.message;
    }

    const value: SwapContextValue = {
        ...state,
        quote,
        quoteError,
        inBalance,
        outBalance,
        maxInputAmount,
        switchTokens,
        setInputAmount,
        setOutputAmount,
        setSlippageBps,
        selectToken,
        openTokenSelector: (type) =>
            setState((prev) => ({
                ...prev,
                selector: type,
            })),
        closeTokenSelector: () =>
            setState((prev) => ({
                ...prev,
                selector: Selector.None,
            })),
        executeSwap: async () => {
            try {
                const inputToken = state.inputToken;
                const outputToken = state.outputToken;
                if (!quote) throw new Error("No quote available");
                if (!user) throw new Error("Wallet not connected");
                const onStatus = (status: number) => {
                    switch (status) {
                        case PROCESS_TRANSACTION_RETRIEVING:
                            setSwapState("retrieving");
                            break;
                        case PROCESS_TRANSACTION_SIGNING:
                            setSwapState("signing");
                            break;
                        case PROCESS_TRANSACTION_SENDING:
                            setSwapState("sending");
                            break;
                        case PROCESS_TRANSACTION_CONFIRMING:
                            setSwapState("confirming");
                            break;
                        default:
                            break;
                    }
                };
                const start = new Date().getTime() / 1000;
                let inputRaw: string = "";
                let outputRaw: string = "";
                const confirmFn = async (
                    signature: string,
                    lastValidBlockHeight: number,
                ) => {
                    const res = await Api.getEffects(
                        signature,
                        inputToken.mint,
                        outputToken.mint,
                        lastValidBlockHeight,
                    );
                    inputRaw = res.inputRaw;
                    outputRaw = res.outputRaw;
                };
                const signature = await processTransaction(
                    quote.insName,
                    quote.getTransaction(),
                    user,
                    signTransaction,
                    onStatus,
                    confirmFn,
                );
                const txInput =
                    parseInt(inputRaw) / Math.pow(10, inputToken.decimals);
                const txOutput =
                    parseInt(outputRaw) / Math.pow(10, outputToken.decimals);
                const end = new Date().getTime() / 1000;
                setState((prev) => ({
                    ...prev,
                    inputAmount: DECIMAL_ZERO,
                    outputAmount: DECIMAL_ZERO,
                    txInput,
                    txOutput,
                    isSuccessOpen: true,
                    txSeconds: end - start,
                    txHash: signature,
                }));
            } catch (error) {
                console.error("Swap error", error);
                setState((prev) => ({
                    ...prev,
                    isFailedOpen: true,
                    errorDetails: error instanceof Error ? error.message : "",
                }));
            } finally {
                setSwapState("none");
                // reload balances after we try a swap
                setBalanceReloadKey((k) => k + 1);
                reloadBalances();
            }
        },
        dismissError: () =>
            setState((prev) => ({ ...prev, isFailedOpen: false })),
        dismissSuccess: () =>
            setState((prev) => ({ ...prev, isSuccessOpen: false })),
        tokens,
        commonTokens,
        connected: !!user,
        connectWallet,
    };

    return (
        <SwapContext.Provider value={value}>{children}</SwapContext.Provider>
    );
}

export function useSwap() {
    const context = useContext(SwapContext);
    if (!context) {
        throw new Error("useSwap must be used within a SwapProvider");
    }
    return context;
}
