import { IVY_MINT_B58 } from "@/lib/constants";
import {
    createBuyIvyTransaction,
    createSellIvyTransaction,
    createBuyTransaction,
    createSellTransaction,
    ExecuteResponse,
} from "@/lib/execute";
import {
    fetchBuyIvyQuote,
    fetchSellIvyQuote,
    fetchBuyQuote,
    fetchSellQuote,
} from "@/lib/quote";
import { PublicKey } from "@solana/web3.js";
import { SwapToken, Quote } from "../swap/swapTypes";
import { Decimal } from "decimal.js-light";

export async function fetchQuoteInternal(
    user: PublicKey | undefined,
    game: PublicKey,
    gameSwapAlt: PublicKey,
    gameMint: string,
    inputToken: SwapToken,
    outputToken: SwapToken,
    inputAmount: Decimal,
    outputAmount: Decimal,
    slippageBps: number,
): Promise<Quote> {
    if (inputAmount.isZero() || !outputAmount.isZero()) {
        throw new Error("Only ExactIn, non-zero swaps are supported");
    }

    let quote: Quote;
    let er: ExecuteResponse = {
        insName: "",
        getTx: () => {
            throw new Error("must have user to create tx");
        },
    };

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
        if (user) {
            er = createBuyIvyTransaction(
                /* user */ user,
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* jupQuoteResponse */ q.jupQuoteResponse,
            );
        }
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

        if (user) {
            er = createSellIvyTransaction(
                /* user */ user,
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* jupQuoteResponse */ q.jupQuoteResponse,
                /* transformMessage */ q.transformMessage,
            );
        }
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

        if (user) {
            er = createBuyTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ user,
                /* game */ game,
                /* inputToken */ inputMint,
                /* input */ q.input,
                /* inputDecimals */ inputToken.decimals,
                /* minOutput */ q.minOutput,
                /* jupQuoteResponse */ q.jupQuoteResponse,
            );
        }
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

        if (user) {
            er = createSellTransaction(
                /* gameSwapAlt */ gameSwapAlt,
                /* user */ user,
                /* game */ game,
                /* outputToken */ outputMint,
                /* input */ q.input,
                /* minOutput */ q.minOutput,
                /* outputDecimals */ outputToken.decimals,
                /* jupQuoteResponse */ q.jupQuoteResponse,
                /* transformMessage */ q.transformMessage,
            );
        }
        quote = q;
    }

    quote.insName = er.insName;
    quote.getTransaction = er.getTx;

    return quote;
}
