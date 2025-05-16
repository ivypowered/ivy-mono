import { PublicKey } from "@solana/web3.js";
import { Quote } from "@/components/swap/swapTypes";
import { USDC_MINT } from "./constants";
import { IVY_MINT, GAME_DECIMALS } from "@/import/ivy-sdk";
import { Api } from "./api";
import { Jup } from "./jup";

async function fetchJupiterExactIn(
    user: PublicKey | undefined,
    inputToken: PublicKey,
    outputToken: PublicKey,
    inAmountRaw: number,
    slippageBps: number,
) {
    // Use the new Jup.fetchQuote method with ExactIn swapMode
    const orderResponse = await Jup.fetchOrder(
        inputToken,
        outputToken,
        inAmountRaw,
        slippageBps,
        {
            swapMode: "ExactIn",
            onlyDirectRoutes: false,
            asLegacyTransaction: false,
            minimizeSlippage: false,
            // When composing mixed transactions,
            // the maximum total # of unique accounts used is 18.
            // (Note - if we change the smart contract, we'll
            // have to recalculate this value.)
            maxAccounts: 46, // Solana maximum is 64 locked per tx
            taker: user ? user.toBase58() : undefined,
        },
    );

    // Extract required data from response
    const inputRaw = parseInt(orderResponse.inAmount);
    const outputRaw = parseInt(orderResponse.outAmount);

    const priceImpactBps = parseFloat(orderResponse.priceImpactPct) * 10000; // Convert to basis points

    // Extract route stops if available
    const routePlan = orderResponse.routePlan || [];
    const stopsList = routePlan
        .map((plan) => plan.swapInfo?.label || "")
        .filter((x) => x.length > 0);
    const stops = Array.from(new Set(stopsList));

    return {
        inputRaw,
        outputRaw,
        stops,
        priceImpactBps,
        txBase64: orderResponse.transaction,
    };
}

export async function fetchBuyQuote(
    user: PublicKey | undefined,
    game: PublicKey,
    inputToken: PublicKey,
    inputAmount: number,
    inputDecimals: number,
    slippageBps: number,
): Promise<Quote & { txBase64: string | null }> {
    const inputRaw = inputAmount * Math.pow(10, inputDecimals);

    if (inputToken.equals(IVY_MINT)) {
        // IVY -> GAME
        const quoteData = await Api.getGameQuote(game, inputRaw, true);
        const outputRaw = quoteData.output_amount;
        const minOutputRaw = outputRaw * (1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: quoteData.input_amount_usd,
            maxInput: 0,
            output: outputRaw / Math.pow(10, GAME_DECIMALS),
            outputUSD: quoteData.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, GAME_DECIMALS),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: quoteData.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    }

    if (inputToken.equals(USDC_MINT)) {
        // USDC -> IVY -> GAME: Fetch both quotes concurrently
        const ivyQuotePromise = Api.getIvyQuote(inputRaw, true);
        const ivyQuote = await ivyQuotePromise;

        const gameQuote = await Api.getGameQuote(
            game,
            ivyQuote.output_amount,
            true,
        );

        const gameOutputRaw = gameQuote.output_amount;
        const minOutputRaw = gameOutputRaw * (1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: ivyQuote.input_amount_usd,
            maxInput: 0,
            output: gameOutputRaw / Math.pow(10, GAME_DECIMALS),
            outputUSD: gameQuote.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, GAME_DECIMALS),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: gameQuote.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    }

    // * -> USDC -> IVY -> GAME
    // First hop: * -> USDC through Jupiter, fetch concurrently with token price
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
        ivyQuote.output_amount,
        true,
    );

    const gameOutputRaw = gameQuote.output_amount;
    const minOutputRaw = gameOutputRaw * (1 - slippageBps / 10_000);
    const inputUSD = inputAmount * inputTokenPrice;

    return {
        input: inputAmount,
        inputUSD: inputUSD,
        maxInput: 0,
        output: gameOutputRaw / Math.pow(10, GAME_DECIMALS),
        outputUSD: gameQuote.output_amount_usd,
        minOutput: minOutputRaw / Math.pow(10, GAME_DECIMALS),
        getTransaction: () => {
            throw new Error("Execution Unimplemented");
        },
        stops: [...jupiterQuote.stops, "Ivy"],
        priceImpactBps: gameQuote.price_impact_bps,
        slippageBps,
        txBase64: jupiterQuote.txBase64,
    };
}

export async function fetchSellQuote(
    user: PublicKey | undefined,
    game: PublicKey,
    outputToken: PublicKey,
    inputAmount: number,
    outputDecimals: number,
    slippageBps: number,
): Promise<Quote & { txBase64: string | null }> {
    const inputRaw = inputAmount * Math.pow(10, GAME_DECIMALS);

    if (outputToken.equals(IVY_MINT)) {
        // GAME -> IVY
        const quoteData = await Api.getGameQuote(game, inputRaw, false);
        const outputRaw = quoteData.output_amount;
        const minOutputRaw = outputRaw * (1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: quoteData.input_amount_usd,
            maxInput: 0,
            output: outputRaw / Math.pow(10, outputDecimals),
            outputUSD: quoteData.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, outputDecimals),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: quoteData.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    }

    if (outputToken.equals(USDC_MINT)) {
        // GAME -> IVY -> USDC
        // First fetch GAME -> IVY quote
        const ivyQuote = await Api.getGameQuote(game, inputRaw, false);

        // Then fetch IVY -> USDC quote
        const usdcQuote = await Api.getIvyQuote(ivyQuote.output_amount, false);

        const usdcOutputRaw = usdcQuote.output_amount;
        const minOutputRaw = usdcOutputRaw * (1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: ivyQuote.input_amount_usd,
            maxInput: 0,
            output: usdcOutputRaw / Math.pow(10, outputDecimals),
            outputUSD: usdcQuote.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, outputDecimals),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    }

    // GAME -> IVY -> USDC -> *
    // First hop: GAME -> IVY
    const ivyQuote = await Api.getGameQuote(game, inputRaw, false);

    // Second hop: IVY -> USDC
    const usdcQuote = await Api.getIvyQuote(ivyQuote.output_amount, false);

    // Third hop: USDC -> * through Jupiter
    // Get Jupiter quote and token price concurrently
    const [jupiterQuote, outputTokenPrices] = await Promise.all([
        fetchJupiterExactIn(
            user,
            USDC_MINT,
            outputToken,
            usdcQuote.output_amount,
            slippageBps,
        ),
        Jup.fetchPrices([outputToken]),
    ]);
    const outputTokenPrice = outputTokenPrices[0];

    const finalOutputRaw = jupiterQuote.outputRaw;
    const minOutputRaw = finalOutputRaw * (1 - slippageBps / 10_000);

    const outputUSD =
        (finalOutputRaw / Math.pow(10, outputDecimals)) * outputTokenPrice;

    return {
        input: inputAmount,
        inputUSD: ivyQuote.input_amount_usd,
        maxInput: 0,
        output: finalOutputRaw / Math.pow(10, outputDecimals),
        outputUSD: outputUSD,
        minOutput: minOutputRaw / Math.pow(10, outputDecimals),
        getTransaction: () => {
            throw new Error("Execution Unimplemented");
        },
        stops: ["Ivy", ...jupiterQuote.stops],
        priceImpactBps: ivyQuote.price_impact_bps,
        slippageBps,
        txBase64: jupiterQuote.txBase64,
    };
}

export async function fetchBuyIvyQuote(
    user: PublicKey | undefined,
    inputToken: PublicKey,
    inputAmount: number,
    inputDecimals: number,
    slippageBps: number,
): Promise<Quote & { txBase64: string | null }> {
    const inputRaw = inputAmount * Math.pow(10, inputDecimals);

    if (inputToken.equals(USDC_MINT)) {
        // USDC -> IVY (direct route)
        const ivyQuote = await Api.getIvyQuote(inputRaw, true);
        const outputRaw = ivyQuote.output_amount;
        const minOutputRaw = outputRaw * (1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: ivyQuote.input_amount_usd,
            maxInput: 0,
            output: outputRaw / Math.pow(10, 9), // IVY decimals is 9
            outputUSD: ivyQuote.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, 9),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    } else {
        // * -> USDC -> IVY (via Jupiter for first hop)
        // First hop: * -> USDC
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

        const outputRaw = ivyQuote.output_amount;
        const minOutputRaw = outputRaw * (1 - slippageBps / 10_000);
        const inputUSD = inputAmount * inputTokenPrice;

        return {
            input: inputAmount,
            inputUSD: inputUSD,
            maxInput: 0,
            output: outputRaw / Math.pow(10, 9), // IVY decimals is 9
            outputUSD: ivyQuote.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, 9),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: [...jupiterQuote.stops, "Ivy"],
            priceImpactBps: ivyQuote.price_impact_bps,
            slippageBps,
            txBase64: jupiterQuote.txBase64,
        };
    }
}

export async function fetchSellIvyQuote(
    user: PublicKey | undefined,
    outputToken: PublicKey,
    ivyAmount: number,
    outputDecimals: number,
    slippageBps: number,
): Promise<Quote & { txBase64: string | null }> {
    const inputRaw = ivyAmount * Math.pow(10, 9); // IVY decimals is 9

    if (outputToken.equals(USDC_MINT)) {
        // IVY -> USDC (direct route)
        const usdcQuote = await Api.getIvyQuote(inputRaw, false);
        const outputRaw = usdcQuote.output_amount;
        const minOutputRaw = outputRaw * (1 - slippageBps / 10_000);

        return {
            input: ivyAmount,
            inputUSD: usdcQuote.input_amount_usd,
            maxInput: 0,
            output: outputRaw / Math.pow(10, outputDecimals),
            outputUSD: usdcQuote.output_amount_usd,
            minOutput: minOutputRaw / Math.pow(10, outputDecimals),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy"],
            priceImpactBps: usdcQuote.price_impact_bps,
            slippageBps,
            txBase64: null,
        };
    } else {
        // IVY -> USDC -> * (via Jupiter for second hop)
        // First hop: IVY -> USDC
        const usdcQuote = await Api.getIvyQuote(inputRaw, false);

        // Second hop: USDC -> *
        const [jupiterQuote, outputTokenPrices] = await Promise.all([
            fetchJupiterExactIn(
                user,
                USDC_MINT,
                outputToken,
                usdcQuote.output_amount,
                slippageBps,
            ),
            Jup.fetchPrices([outputToken]),
        ]);
        const outputTokenPrice = outputTokenPrices[0];

        const finalOutputRaw = jupiterQuote.outputRaw;
        const minOutputRaw = finalOutputRaw * (1 - slippageBps / 10_000);
        const outputUSD =
            (finalOutputRaw / Math.pow(10, outputDecimals)) * outputTokenPrice;

        return {
            input: ivyAmount,
            inputUSD: usdcQuote.input_amount_usd,
            maxInput: 0,
            output: finalOutputRaw / Math.pow(10, outputDecimals),
            outputUSD: outputUSD,
            minOutput: minOutputRaw / Math.pow(10, outputDecimals),
            getTransaction: () => {
                throw new Error("Execution Unimplemented");
            },
            stops: ["Ivy", ...jupiterQuote.stops],
            priceImpactBps: usdcQuote.price_impact_bps,
            slippageBps,
            txBase64: jupiterQuote.txBase64,
        };
    }
}
