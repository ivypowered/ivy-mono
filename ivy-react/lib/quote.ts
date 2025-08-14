// lib/quote.ts
import { PublicKey, TransactionMessage } from "@solana/web3.js";
import { Quote } from "@/components/swap/swapTypes";
import {
    JUP_IX_CREATE_TOKEN_ACCOUNT_TAG,
    JUP_IX_ROUTE_TAG,
    JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
    JUP_PROGRAM_ID,
    WSOL_MINT,
    TOKEN_PROGRAM_ID,
    USDC_MINT,
    DECIMAL_ZERO,
} from "./constants";
import {
    IVY_MINT,
    GAME_DECIMALS,
    getAssociatedTokenAddressSync,
} from "@/import/ivy-sdk";
import { Api } from "./api";
import { Jup, JupiterQuoteResponse } from "./jup";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { Decimal } from "decimal.js-light";

/// Fetch an ExactIn quote from Jupiter Lite API
async function fetchJupiterExactIn(
    user: PublicKey | undefined, // unused by quote; kept for signature compatibility
    inputToken: PublicKey,
    outputToken: PublicKey,
    inAmountRaw: string,
    slippageBps: number,
) {
    const maxAccounts = 24;

    const quoteResponse = await Jup.fetchQuote(
        inputToken,
        outputToken,
        parseInt(inAmountRaw), // Jupiter API expects number
        slippageBps,
        {
            swapMode: "ExactIn",
            onlyDirectRoutes: true,
            asLegacyTransaction: false,
            maxAccounts,
            restrictIntermediateTokens: true,
            excludeDexes: ["Obric V2"],
        },
    );

    const inputRaw = quoteResponse.inAmount;
    const outputRaw = quoteResponse.outAmount;

    const priceImpactBps = parseFloat(quoteResponse.priceImpactPct) * 10000;

    const routePlan = quoteResponse.routePlan || [];
    const stopsList = routePlan
        .map((plan) => plan.swapInfo?.label || "")
        .filter((x) => x.length > 0);
    const stops = Array.from(new Set(stopsList));

    return {
        inputRaw,
        outputRaw,
        stops,
        priceImpactBps,
        jupQuoteResponse: quoteResponse,
    };
}

// Binance 3, ~891M USDC
const BIG_USDC_HOLDER = new PublicKey(
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);
const BIG_USDC_HOLDER_B58 = BIG_USDC_HOLDER.toBase58();
const BIG_USDC_USDC_ACCOUNT_B58 = getAssociatedTokenAddressSync(
    USDC_MINT,
    BIG_USDC_HOLDER,
).toBase58();
const BIG_USDC_WSOL_ACCOUNT_B58 =
    "Ft7A291TPAvLzckj1jfBRqww5eqvaerJ1nUnDJSnUY8a";
const BIG_USDC_WSOL_ACCOUNT = new PublicKey(BIG_USDC_WSOL_ACCOUNT_B58);

function transformMessage(
    msg: TransactionMessage,
    user: PublicKey,
    mint: PublicKey,
) {
    const userMintAccount = getAssociatedTokenAddressSync(mint, user);
    const userWsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, user);
    const accountMap: Record<string, PublicKey | undefined> = {
        [BIG_USDC_HOLDER_B58]: user,
        [BIG_USDC_USDC_ACCOUNT_B58]: getAssociatedTokenAddressSync(
            USDC_MINT,
            user,
        ),
        [getAssociatedTokenAddressSync(mint, BIG_USDC_HOLDER).toBase58()]:
            userMintAccount,
        [BIG_USDC_WSOL_ACCOUNT_B58]: userWsolAccount,
    };

    const newInstructions = [];
    let requiresWsol = false;
    let routeIndex = -1;

    for (const ins of msg.instructions) {
        // Check for CloseAccount instructions
        if (
            ins.programId.equals(TOKEN_PROGRAM_ID) &&
            ins.data.length &&
            ins.data[0] === 9
        ) {
            const account = ins.keys[0];
            if (account.pubkey.equals(BIG_USDC_WSOL_ACCOUNT)) {
                requiresWsol = true;
            } else {
                console.warn(
                    "Jupiter instruction closes unknown token account: only WSOL is supported by this algorithm",
                );
            }
        }

        if (ins.programId.equals(JUP_PROGRAM_ID) && ins.data.length >= 8) {
            const tag = ins.data.subarray(0, 8);
            if (JUP_IX_CREATE_TOKEN_ACCOUNT_TAG.equals(tag)) {
                continue; // Filter out create token account instructions
            }
            if (
                JUP_IX_ROUTE_TAG.equals(tag) ||
                JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG.equals(tag)
            ) {
                routeIndex = newInstructions.length;
            }
        }

        // Update pubkeys in the instruction
        for (const k of ins.keys) {
            const equivalent = accountMap[k.pubkey.toBase58()];
            if (equivalent) {
                k.pubkey = equivalent;
            }
        }

        newInstructions.push(ins);
    }

    if (routeIndex < 0) {
        throw new Error("can't find jup route ix");
    }

    msg.instructions = [
        ...newInstructions.slice(0, routeIndex),
        ...(requiresWsol && !mint.equals(WSOL_MINT)
            ? [
                  createAssociatedTokenAccountIdempotentInstruction(
                      user,
                      userWsolAccount,
                      user,
                      WSOL_MINT,
                  ),
              ]
            : []),
        createAssociatedTokenAccountIdempotentInstruction(
            user,
            userMintAccount,
            user,
            mint,
        ),
        ...newInstructions.slice(routeIndex),
    ];
    msg.payerKey = user;
}

export async function fetchBuyQuote(
    user: PublicKey | undefined,
    game: PublicKey,
    inputToken: PublicKey,
    inputAmount: Decimal,
    inputDecimals: number,
    slippageBps: number,
): Promise<Quote & { jupQuoteResponse: JupiterQuoteResponse | null }> {
    const inputRaw = inputAmount
        .mul(new Decimal(10).pow(inputDecimals))
        .toFixed(0);

    if (inputToken.equals(IVY_MINT)) {
        // IVY -> GAME
        const quoteData = await Api.getGameQuote(game, inputRaw, true);
        const outputRaw = new Decimal(quoteData.output_amount);
        const minOutputRaw = outputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: new Decimal(quoteData.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: outputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
            outputUSD: new Decimal(quoteData.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: quoteData.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
        };
    }

    if (inputToken.equals(USDC_MINT)) {
        // USDC -> IVY -> GAME: Fetch both quotes concurrently
        const ivyQuote = await Api.getIvyQuote(inputRaw, true);
        const gameQuote = await Api.getGameQuote(
            game,
            ivyQuote.output_amount.toString(),
            true,
        );

        const gameOutputRaw = new Decimal(gameQuote.output_amount);
        const minOutputRaw = gameOutputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: new Decimal(ivyQuote.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: gameOutputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
            outputUSD: new Decimal(gameQuote.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: gameQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
        };
    }

    // * -> USDC -> IVY -> GAME
    const [jupiterQuote, inputTokenPrices] = await Promise.all([
        fetchJupiterExactIn(user, inputToken, USDC_MINT, inputRaw, slippageBps),
        Jup.fetchPrices([inputToken]),
    ]);
    const inputTokenPrice = inputTokenPrices[0];

    // Second hop: USDC -> IVY
    const ivyQuote = await Api.getIvyQuote(jupiterQuote.outputRaw, true);

    // Third hop: IVY -> GAME
    const gameQuote = await Api.getGameQuote(
        game,
        ivyQuote.output_amount.toString(),
        true,
    );

    const gameOutputRaw = new Decimal(gameQuote.output_amount);
    const minOutputRaw = gameOutputRaw.mul(1 - slippageBps / 10_000);
    const inputUSD = inputAmount.mul(inputTokenPrice);

    return {
        input: inputAmount,
        inputUSD: inputUSD,
        maxInput: DECIMAL_ZERO,
        output: gameOutputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
        outputUSD: new Decimal(gameQuote.output_amount_usd),
        minOutput: minOutputRaw.div(new Decimal(10).pow(GAME_DECIMALS)),
        insName: "",
        getTransaction: () => {
            throw new Error("Execution Unimplemented");
        },
        stops: [...jupiterQuote.stops, "Ivy"],
        priceImpactBps: gameQuote.price_impact_bps,
        slippageBps,
        jupQuoteResponse: jupiterQuote.jupQuoteResponse,
    };
}

export async function fetchSellQuote(
    user: PublicKey | undefined,
    game: PublicKey,
    outputToken: PublicKey,
    inputAmount: Decimal,
    outputDecimals: number,
    slippageBps: number,
): Promise<
    Quote & {
        jupQuoteResponse: JupiterQuoteResponse | null;
        transformMessage: (msg: TransactionMessage) => void;
    }
> {
    const inputRaw = inputAmount
        .mul(new Decimal(10).pow(GAME_DECIMALS))
        .toFixed(0);

    if (outputToken.equals(IVY_MINT)) {
        // GAME -> IVY
        const quoteData = await Api.getGameQuote(game, inputRaw, false);
        const outputRaw = new Decimal(quoteData.output_amount);
        const minOutputRaw = outputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: new Decimal(quoteData.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: outputRaw.div(new Decimal(10).pow(outputDecimals)),
            outputUSD: new Decimal(quoteData.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: quoteData.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
            transformMessage: () => {},
        };
    }

    if (outputToken.equals(USDC_MINT)) {
        // GAME -> IVY -> USDC
        const ivyQuote = await Api.getGameQuote(game, inputRaw, false);
        const usdcQuote = await Api.getIvyQuote(
            ivyQuote.output_amount.toString(),
            false,
        );

        const usdcOutputRaw = new Decimal(usdcQuote.output_amount);
        const minOutputRaw = usdcOutputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: new Decimal(ivyQuote.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: usdcOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            outputUSD: new Decimal(usdcQuote.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
            transformMessage: () => {},
        };
    }

    // GAME -> IVY -> USDC -> *
    const ivyQuote = await Api.getGameQuote(game, inputRaw, false);
    const usdcQuote = await Api.getIvyQuote(
        ivyQuote.output_amount.toString(),
        false,
    );

    // USDC -> * through Jupiter (requires transformation)
    const [jupiterQuote, outputTokenPrices] = await Promise.all([
        fetchJupiterExactIn(
            user ? BIG_USDC_HOLDER : undefined,
            USDC_MINT,
            outputToken,
            usdcQuote.output_amount.toString(),
            slippageBps,
        ),
        Jup.fetchPrices([outputToken]),
    ]);
    const outputTokenPrice = outputTokenPrices[0];

    const finalOutputRaw = new Decimal(jupiterQuote.outputRaw);
    const minOutputRaw = finalOutputRaw.mul(1 - slippageBps / 10_000);

    const outputUSD = finalOutputRaw
        .div(new Decimal(10).pow(outputDecimals))
        .mul(outputTokenPrice);

    return {
        input: inputAmount,
        inputUSD: new Decimal(ivyQuote.input_amount_usd),
        maxInput: DECIMAL_ZERO,
        output: finalOutputRaw.div(new Decimal(10).pow(outputDecimals)),
        outputUSD: outputUSD,
        minOutput: minOutputRaw.div(new Decimal(10).pow(outputDecimals)),
        insName: "",
        getTransaction: () => {
            throw new Error("Execution Unimplemented");
        },
        stops: ["Ivy", ...jupiterQuote.stops],
        priceImpactBps: ivyQuote.price_impact_bps,
        slippageBps,
        jupQuoteResponse: jupiterQuote.jupQuoteResponse,
        transformMessage: user
            ? (msg) => transformMessage(msg, user, outputToken)
            : () => {},
    };
}

export async function fetchBuyIvyQuote(
    user: PublicKey | undefined,
    inputToken: PublicKey,
    inputAmount: Decimal,
    inputDecimals: number,
    slippageBps: number,
): Promise<
    Quote & {
        jupQuoteResponse: JupiterQuoteResponse | null;
    }
> {
    const inputRaw = inputAmount
        .mul(new Decimal(10).pow(inputDecimals))
        .toFixed(0);

    if (inputToken.equals(USDC_MINT)) {
        // USDC -> IVY (direct route)
        const ivyQuote = await Api.getIvyQuote(inputRaw, true);
        const outputRaw = new Decimal(ivyQuote.output_amount);
        const minOutputRaw = outputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: new Decimal(ivyQuote.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: outputRaw.div(new Decimal(10).pow(9)), // IVY decimals is 9
            outputUSD: new Decimal(ivyQuote.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(9)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
        };
    } else {
        // * -> USDC -> IVY (via Jupiter for first hop)
        const [jupiterQuote, inputTokenPrices] = await Promise.all([
            fetchJupiterExactIn(
                user,
                inputToken,
                USDC_MINT,
                inputRaw,
                slippageBps,
            ),
            Jup.fetchPrices([inputToken]),
        ]);
        const inputTokenPrice = inputTokenPrices[0];

        // Second hop: USDC -> IVY
        const ivyQuote = await Api.getIvyQuote(jupiterQuote.outputRaw, true);

        const outputRaw = new Decimal(ivyQuote.output_amount);
        const minOutputRaw = outputRaw.mul(1 - slippageBps / 10_000);
        const inputUSD = inputAmount.mul(inputTokenPrice);

        return {
            input: inputAmount,
            inputUSD: inputUSD,
            maxInput: DECIMAL_ZERO,
            output: outputRaw.div(new Decimal(10).pow(9)), // IVY decimals is 9
            outputUSD: new Decimal(ivyQuote.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(9)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: [...jupiterQuote.stops, "Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: jupiterQuote.jupQuoteResponse,
        };
    }
}

export async function fetchSellIvyQuote(
    user: PublicKey | undefined,
    outputToken: PublicKey,
    ivyAmount: Decimal,
    outputDecimals: number,
    slippageBps: number,
): Promise<
    Quote & {
        jupQuoteResponse: JupiterQuoteResponse | null;
        transformMessage: (msg: TransactionMessage) => void;
    }
> {
    const inputRaw = ivyAmount.mul(new Decimal(10).pow(9)).toFixed(0); // IVY decimals is 9

    if (outputToken.equals(USDC_MINT)) {
        // IVY -> USDC (direct route)
        const usdcQuote = await Api.getIvyQuote(inputRaw, false);
        const outputRaw = new Decimal(usdcQuote.output_amount);
        const minOutputRaw = outputRaw.mul(1 - slippageBps / 10_000);

        return {
            input: ivyAmount,
            inputUSD: new Decimal(usdcQuote.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: outputRaw.div(new Decimal(10).pow(outputDecimals)),
            outputUSD: new Decimal(usdcQuote.output_amount_usd),
            minOutput: minOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: usdcQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: null,
            transformMessage: () => {},
        };
    } else {
        // IVY -> USDC -> * (via Jupiter for second hop)
        const usdcQuote = await Api.getIvyQuote(inputRaw, false);

        const [jupiterQuote, outputTokenPrices] = await Promise.all([
            fetchJupiterExactIn(
                user ? BIG_USDC_HOLDER : undefined,
                USDC_MINT,
                outputToken,
                usdcQuote.output_amount.toString(),
                slippageBps,
            ),
            Jup.fetchPrices([outputToken]),
        ]);
        const outputTokenPrice = outputTokenPrices[0];

        const finalOutputRaw = new Decimal(jupiterQuote.outputRaw);
        const minOutputRaw = finalOutputRaw.mul(1 - slippageBps / 10_000);
        const outputUSD = finalOutputRaw
            .div(new Decimal(10).pow(outputDecimals))
            .mul(outputTokenPrice);

        return {
            input: ivyAmount,
            inputUSD: new Decimal(usdcQuote.input_amount_usd),
            maxInput: DECIMAL_ZERO,
            output: finalOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            outputUSD: outputUSD,
            minOutput: minOutputRaw.div(new Decimal(10).pow(outputDecimals)),
            insName: "",
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy", ...jupiterQuote.stops],
            priceImpactBps: usdcQuote.price_impact_bps,
            slippageBps,
            jupQuoteResponse: jupiterQuote.jupQuoteResponse,
            transformMessage: user
                ? (msg) => transformMessage(msg, user, outputToken)
                : () => {},
        };
    }
}
