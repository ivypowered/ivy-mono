// components/swap/swapTypes.ts
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { Decimal } from "decimal.js-light";
Decimal.config({
    precision: 20,
    rounding: Decimal.ROUND_DOWN,
    toExpNeg: -9,
    toExpPos: 20,
});

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
    inputAmount: Decimal | undefined;
    outputAmount: Decimal | undefined;
    switchKey: number;
    activeSide: ActiveSide;
    slippageBps: number;

    // UI State
    isSuccessOpen: boolean;
    isFailedOpen: boolean;
    btn: Btn;
    selector: Selector;

    // Transaction State
    txHash: string;
    txInput: number;
    txOutput: number;
    errorDetails: string;
    txSeconds: number;
}

export interface SwapContextValue extends SwapState {
    // Dynamic State
    quote: Quote | undefined;
    quoteError: string;
    inBalance: Decimal | undefined;
    outBalance: Decimal | undefined;
    maxInputAmount: Decimal | undefined;

    // Token & Amount Actions
    switchTokens: () => void;
    setInputAmount: (amount: Decimal) => void;
    setOutputAmount: (amount: Decimal) => void;
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
    input: Decimal;
    inputUSD: Decimal;
    maxInput: Decimal;
    output: Decimal;
    outputUSD: Decimal;
    minOutput: Decimal;
    insName: string;
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
