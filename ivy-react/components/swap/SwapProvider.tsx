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
import { DEFAULT_SLIPPAGE_BPS, MAX_SF, WSOL_MINT_B58 } from "@/lib/constants";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useQuoteResult } from "./QuoteProvider";
import { useBalance } from "./BalanceProvider";
import { useMediaQuery } from "@/lib/use-media-query";

const SwapContext = createContext<SwapContextValue | undefined>(undefined);

interface SwapProviderProps {
    children: ReactNode;
    commonTokens: SwapToken[];
    connectWallet: () => void;
    fetchBalance: (user: PublicKey, token: SwapToken) => Promise<number>;
    fetchTransactionEffects: (
        user: PublicKey,
        signature: string,
        inputMint: string,
        outputMint: string,
    ) => Promise<{
        input: number;
        output: number;
    }>;
    fetchQuote: (
        user: PublicKey | undefined,
        inputToken: SwapToken,
        outputToken: SwapToken,
        inputAmount: number,
        outputAmount: number,
        slippageBps: number,
    ) => Promise<Quote>;
    initialInputToken: SwapToken;
    initialOutputToken: SwapToken;
    reloadBalances: () => void;
    signTransaction: (
        tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>;
    tokens: SwapToken[] | undefined;
    user: PublicKey | undefined;
    updateBalanceRef: {
        current: ((mint: string, amount: number) => void) | null;
    };
}

const REFRESH_MS = 15_000;

export function SwapProvider({
    children,
    commonTokens,
    connectWallet,
    fetchBalance,
    fetchTransactionEffects,
    fetchQuote,
    initialInputToken,
    initialOutputToken,
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
        inputAmount: 0,
        outputAmount: 0,
        activeSide: ActiveSide.Input,
        slippageBps: DEFAULT_SLIPPAGE_BPS,

        isSuccessOpen: false,
        isFailedOpen: false,
        btn: user ? Btn.ConnectWallet : Btn.EnterAnAmount,
        selector: Selector.None,

        txInput: 0,
        txOutput: 0,
        txHash: "",
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
        return () => clearTimeout(id);
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
            (state.inputAmount || 0) > (inBalance || 0)) ||
            (state.activeSide === ActiveSide.Output &&
                (state.outputAmount || 0) > (outBalance || 0))
            ? undefined
            : user,
        state.inputToken,
        state.outputToken,
        state.activeSide === ActiveSide.Input ? state.inputAmount || 0 : 0,
        state.activeSide === ActiveSide.Output ? state.outputAmount || 0 : 0,
        state.slippageBps,
        refreshKey,
        fetchQuote,
    );
    const isTiny = useMediaQuery("(max-width: 359px)");
    useEffect(() => {
        switch (quoteResult.status) {
            case "error":
            case "loading":
                if (state.activeSide === ActiveSide.Input) {
                    setState((prev) => ({
                        ...prev,
                        outputAmount: prev.inputAmount ? undefined : 0,
                    }));
                } else {
                    setState((prev) => ({
                        ...prev,
                        inputAmount: prev.outputAmount ? undefined : 0,
                    }));
                }
                break;
            case "success":
                const quote = quoteResult.quote;
                if (state.activeSide === ActiveSide.Input) {
                    setState((prev) => ({
                        ...prev,
                        // only show 6 decimals on small mobile devices
                        // to prevent overflow
                        outputAmount: sfcap(quote.output, isTiny ? 6 : MAX_SF),
                    }));
                } else {
                    setState((prev) => ({
                        ...prev,
                        inputAmount: sfcap(quote.input, isTiny ? 6 : MAX_SF),
                    }));
                }
                break;
            case "invalid":
                if (state.activeSide === ActiveSide.Input) {
                    setState((prev) => ({
                        ...prev,
                        outputAmount: 0,
                    }));
                } else {
                    setState((prev) => ({
                        ...prev,
                        inputAmount: 0,
                    }));
                }
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteResult]);

    useEffect(() => {
        updateBalanceRef.current = (mint: string, amount: number) => {
            if (state.inputToken.mint === mint) {
                setInBalance(amount);
            } else if (state.outputToken.mint === mint) {
                setOutBalance(amount);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [updateBalanceRef]);

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
            if (!user) {
                return Btn.ConnectWallet;
            }
            if (!state.inputAmount && !state.outputAmount) {
                return Btn.EnterAnAmount;
            }
            if (quoteResult.status === "error") {
                return Btn.QuoteError;
            }
            if (quoteResult.status === "loading") {
                return Btn.Loading;
            }
            if ((state.inputAmount || 0) > (inBalance || 0)) {
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

    const switchTokens = () => {
        setState((prev) => ({
            ...prev,
            inputToken: prev.outputToken,
            outputToken: prev.inputToken,
            inputFixed: prev.outputFixed,
            outputFixed: prev.inputFixed,
            inputAmount:
                prev.activeSide === ActiveSide.Input
                    ? prev.outputAmount
                    : undefined,
            outputAmount:
                prev.activeSide === ActiveSide.Output
                    ? prev.inputAmount
                    : undefined,
        }));
    };

    const setInputAmount = useCallback(
        (amount: number) => {
            if (amount === state.inputAmount) {
                return;
            }
            setState((prev) => ({
                ...prev,
                inputAmount: amount,
                activeSide: ActiveSide.Input,
            }));
        },
        [state.inputAmount],
    );

    const setOutputAmount = useCallback(
        (amount: number) => {
            if (amount === state.outputAmount) {
                return;
            }
            setState((prev) => ({
                ...prev,
                outputAmount: amount,
                activeSide: ActiveSide.Output,
            }));
        },
        [state.outputAmount],
    );

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

    const maxInputAmount: number | undefined = useMemo(() => {
        if (
            inBalance === undefined ||
            state.inputToken.mint !== WSOL_MINT_B58
        ) {
            return inBalance;
        }
        // Solana, we want to keep atl 0.01 SOL
        // to cover network fees + ATA creation
        return Math.max(0, inBalance - 0.01);
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
                if (!quote) throw new Error("No quote available");
                if (!user) throw new Error("Wallet not connected");
                const inputAmount = quote.input;
                const inputMint = state.inputToken.mint;
                const outputMint = state.outputToken.mint;
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
                const start = Math.floor(new Date().getTime() / 1000);
                const signature = await processTransaction(
                    quote.getTransaction(),
                    user,
                    signTransaction,
                    onStatus,
                );
                const eff = await fetchTransactionEffects(
                    user,
                    signature,
                    inputMint,
                    outputMint,
                );
                const input =
                    inputMint === WSOL_MINT_B58 ? inputAmount : eff.input;
                const output = eff.output;
                const end = Math.floor(new Date().getTime() / 1000);
                setState((prev) => ({
                    ...prev,
                    inputAmount: 0,
                    outputAmount: 0,
                    isSuccessOpen: true,
                    txSeconds: end - start,
                    txInput: input,
                    txOutput: output,
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
