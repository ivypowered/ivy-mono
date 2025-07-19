import {
    AddressLookupTableAccount,
    PublicKey,
    Transaction,
    VersionedTransaction,
} from "@solana/web3.js";
import { API_BASE } from "./constants";

// --- Interfaces ---

interface Candle {
    open_time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    trades: number;
}

export interface ChartResponse {
    candles: Candle[];
    mkt_cap_usd: number;
    change_24h: number;
}

export type ChartKind = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

interface ApiQuoteData {
    output_amount: number;
    input_amount_usd: number;
    output_amount_usd: number;
    price_impact_bps: number;
}

interface WorldAltResponse {
    key: string;
    data: string;
}

interface SendTransactionResponse {
    signature: string;
}

interface TokenDeltas {
    [mintAddress: string]: number;
}

export interface Context {
    blockhash: string;
    lastValidBlockHeight: number;
    reasonablePriorityFee: number;
}

export interface CommentData {
    index: number;
    user: string;
    timestamp: string;
    text: string;
}

export interface CommentInfo {
    total: number;
    comment_buf_index: number;
    comments: CommentData[];
}

type ApiResponse<T> =
    | { status: "ok"; data: T }
    | { status: "err"; msg: string };

// --- API Class ---
export class Api {
    /** Generic helper to make API requests and handle standard response format */
    private static async fetchApi<T>(
        endpoint: string,
        options?: RequestInit,
    ): Promise<T> {
        const response = await fetch(API_BASE + endpoint, options);

        const r: ApiResponse<T> = await response.json();

        if (r.status === "err") {
            throw new Error(r.msg || "Unknown API error");
        }

        return r.data;
    }

    /** Fetches comments from the backend */
    static async getComments(
        game: PublicKey,
        count: number,
        skip: number,
        reverse: boolean,
    ): Promise<CommentInfo> {
        return this.fetchApi<CommentInfo>(
            `/comments/${game.toBase58()}?count=${count}&skip=${skip}&reverse=${reverse}`,
        );
    }

    /** Fetches the world's Address Lookup Table */
    static async getWorldAlt(): Promise<AddressLookupTableAccount> {
        const { key, data } =
            await Api.fetchApi<WorldAltResponse>("/world-alt");
        return new AddressLookupTableAccount({
            key: new PublicKey(key),
            state: AddressLookupTableAccount.deserialize(
                Buffer.from(data, "base64"),
            ),
        });
    }

    /** Fetches IVY swap quote */
    static getIvyQuote(
        inputAmountRaw: number,
        isBuy: boolean,
    ): Promise<ApiQuoteData> {
        return Api.fetchApi<ApiQuoteData>(
            `/ivy/quote?input_amount=${inputAmountRaw}&is_buy=${isBuy}`,
        );
    }

    /** Fetches game swap quote */
    static getGameQuote(
        gameMint: PublicKey,
        inputAmountRaw: number,
        isBuy: boolean,
    ): Promise<ApiQuoteData> {
        return Api.fetchApi<ApiQuoteData>(
            `/games/${gameMint.toBase58()}/quote?input_amount=${inputAmountRaw}&is_buy=${isBuy}`,
        );
    }

    /** Fetches multiple accounts' data as Buffers */
    static async getAccountsData(
        accounts: PublicKey[],
    ): Promise<(Buffer | null)[]> {
        if (accounts.length > 100) {
            throw new Error("Maximum of 100 accounts allowed");
        }

        const data = await Api.fetchApi<(string | null)[]>("/accounts-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                accounts: accounts.map((acc) => acc.toBase58()),
            }),
        });

        return data.map((x) =>
            typeof x === "string" ? Buffer.from(x, "base64") : null,
        );
    }

    /** Gets the user's token balance */
    static async getTokenBalance(
        user: PublicKey,
        mint: PublicKey,
    ): Promise<string> {
        return Api.fetchApi<string>("/token-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user: user.toBase58(),
                mint: mint.toBase58(),
            }),
        });
    }

    /** Gets a game's treasury balance */
    static async getTreasuryBalance(game: PublicKey): Promise<string> {
        return Api.fetchApi<string>("/treasury-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                game: game.toBase58(),
            }),
        });
    }

    /** Sends a signed transaction */
    static async sendTransaction(
        tx: Transaction | VersionedTransaction,
    ): Promise<string> {
        let txData: Buffer;
        if (tx instanceof Transaction) {
            txData = tx.serialize();
        } else {
            txData = Buffer.from(tx.serialize());
        }
        return (
            await Api.fetchApi<SendTransactionResponse>("/tx/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tx_base64: txData.toString("base64"),
                }),
            })
        ).signature;
    }

    /** Confirms a transaction */
    static async confirmTransaction(
        signature: string,
        lastValidBlockHeight: number,
    ): Promise<void> {
        Api.fetchApi<unknown>(
            `/tx/confirm/${signature}?lastValidBlockHeight=${lastValidBlockHeight}`,
        );
    }

    /** Gets token balance changes from a transaction */
    static async getTransactionTokenDeltas(
        user: PublicKey,
        signature: string,
    ): Promise<TokenDeltas> {
        return Api.fetchApi<TokenDeltas>("/tx-token-deltas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user: user.toBase58(),
                signature: signature,
            }),
        });
    }

    /** Gets the latest blockhash and last valid block height */
    static async getContext(): Promise<Context> {
        return Api.fetchApi<Context>("/ctx", {
            method: "GET",
        });
    }

    /**
     * Fetches chart data for a specific game
     */
    static getGameChart(
        gameMint: PublicKey,
        kind: ChartKind,
        count: number = 100,
        afterInclusive: number = 0,
    ): Promise<ChartResponse> {
        return Api.fetchApi<ChartResponse>(
            `/games/${gameMint.toBase58()}/charts/${kind}?count=${count}&after_inclusive=${afterInclusive}`,
        );
    }

    /**
     * Fetches chart data for the global IVY/USDC price
     */
    static getIvyChart(
        kind: ChartKind,
        count: number = 100,
        afterInclusive: number = 0,
    ): Promise<ChartResponse> {
        return Api.fetchApi<ChartResponse>(
            `/ivy/charts/${kind}?count=${count}&after_inclusive=${afterInclusive}`,
        );
    }
}
