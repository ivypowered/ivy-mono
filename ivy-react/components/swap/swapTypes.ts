import { Transaction, VersionedTransaction } from "@solana/web3.js";

export interface SwapToken {
    name: string;
    symbol: string;
    icon: string;
    decimals: number;
    mint: string;
}

export enum ActiveSide {
    Input,
    Output,
}

export enum Selector {
    Input,
    Output,
    None,
}

export enum Btn {
    ConnectWallet,
    EnterAnAmount,
    Loading,
    InsufficientBalance,
    QuoteError,
    ReadyToSwap,
    SwapRetrieving,
    SwapSigning,
    SwapSending,
    SwapConfirming,
}

export interface SwapState {
    // Token & Amount State
    inputToken: SwapToken;
    outputToken: SwapToken;
    inputFixed: boolean;
    outputFixed: boolean;
    inputAmount: number | undefined;
    outputAmount: number | undefined;
    activeSide: ActiveSide;
    slippageBps: number;

    // UI State
    isSuccessOpen: boolean;
    isFailedOpen: boolean;
    btn: Btn;
    selector: Selector;

    // Transaction State
    txInput: number;
    txOutput: number;
    txHash: string;
    errorDetails: string;
    txSeconds: number;
}

export interface SwapContextValue extends SwapState {
    // Dynamic State
    quote: Quote | undefined;
    quoteError: string;
    inBalance: number | undefined;
    outBalance: number | undefined;

    // Token & Amount Actions
    switchTokens: () => void;
    setInputAmount: (amount: number) => void;
    setOutputAmount: (amount: number) => void;
    setSlippageBps: (bps: number) => void;
    selectToken: (token: SwapToken) => void;

    // UI Actions
    openTokenSelector: (type: Exclude<Selector, Selector.None>) => void;
    closeTokenSelector: () => void;

    // Transaction Actions
    executeSwap: () => Promise<void>;
    dismissError: () => void;
    dismissSuccess: () => void;

    // Token Selector
    tokens: SwapToken[] | undefined;
    commonTokens: SwapToken[];

    // Wallet State
    connected: boolean;
    connectWallet: () => void;
}

export interface Quote {
    input: number;
    inputUSD: number;
    maxInput: number;
    output: number;
    outputUSD: number;
    minOutput: number;
    getTransaction: () => Promise<Transaction | VersionedTransaction>;
    stops: string[];
    priceImpactBps: number;
    slippageBps: number;
}

export type QuoteResult =
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "invalid" }
    | { status: "success"; quote: Quote };
