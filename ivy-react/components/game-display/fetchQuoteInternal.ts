import { IVY_MINT_B58 } from "@/lib/constants";
import {
    createBuyIvyTransaction,
    createSellIvyTransaction,
    createBuyTransaction,
    createSellTransaction,
} from "@/lib/execute";
import {
    fetchBuyIvyQuote,
    fetchSellIvyQuote,
    fetchBuyQuote,
    fetchSellQuote,
} from "@/lib/quote";
import { unwrap } from "@/lib/utils";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SwapToken, Quote } from "../swap/swapTypes";

export async function fetchQuoteInternal(
    user: PublicKey | undefined,
    game: PublicKey,
    gameSwapAlt: PublicKey,
    gameMint: string,
    inputToken: SwapToken,
    outputToken: SwapToken,
    inputAmount: number,
    outputAmount: number,
    slippageBps: number,
): Promise<Quote> {
    if (!inputAmount || outputAmount) {
        throw new Error("Only ExactIn, non-zero swaps are supported");
    }

    let quote: Quote;
    let getTx: () => Promise<Transaction | VersionedTransaction>;

    if (inputToken.mint !== gameMint && outputToken.mint === IVY_MINT_B58) {
        // We're buying IVY
        const inputMint = new PublicKey(inputToken.mint);
        const q = await fetchBuyIvyQuote(
            /* user */ user,
            /* inputToken */ inputMint,
            /* inputAmount */ inputAmount,
            /* inputDecimals */ inputToken.decimals,
            /* slippageBps */ slippageBps,
        );

        getTx = () =>
            createBuyIvyTransaction(
                /* user */ unwrap(user, "must have user to create tx"),
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* jupQuoteResponse */ q.jupQuoteResponse,
            );
        quote = q;
    } else if (
        inputToken.mint === IVY_MINT_B58 &&
        outputToken.mint !== gameMint
    ) {
        // We're selling IVY
        const outputMint = new PublicKey(outputToken.mint);
        const q = await fetchSellIvyQuote(
            /* user */ user,
            /* outputToken */ outputMint,
            /* ivyAmount */ inputAmount,
            /* outputDecimals */ outputToken.decimals,
            /* slippageBps */ slippageBps,
        );

        getTx = () =>
            createSellIvyTransaction(
                /* user */ unwrap(user, "must have user to create tx"),
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* jupQuoteResponse */ q.jupQuoteResponse,
                /* transformMessage */ q.transformMessage,
            );
        quote = q;
    } else if (outputToken.mint === gameMint) {
        // We're buying the game token
        const inputMint = new PublicKey(inputToken.mint);
        const q = await fetchBuyQuote(
            /* user */ user,
            /* game */ game,
            /* inputToken */ inputMint,
            /* inputAmount */ inputAmount,
            /* inputDecimals */ inputToken.decimals,
            /* slippageBps */ slippageBps,
        );

        getTx = () =>
            createBuyTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ unwrap(user, "must have user to create tx"),
                /* game */ game,
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* jupQuoteResponse */ q.jupQuoteResponse,
            );
        quote = q;
    } else {
        // We're selling game token
        const outputMint = new PublicKey(outputToken.mint);
        const q = await fetchSellQuote(
            /* user */ user,
            /* game */ game,
            /* outputToken */ outputMint,
            /* inputAmount */ inputAmount,
            /* outputDecimals */ outputToken.decimals,
            /* slippageBps */ slippageBps,
        );

        getTx = () =>
            createSellTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ unwrap(user, "must have user to create tx"),
                /* game */ game,
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* jupQuoteResponse */ q.jupQuoteResponse,
                /* transformMessage */ q.transformMessage,
            );
        quote = q;
    }

    quote.getTransaction = getTx;

    return quote;
}
