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
} from "./constants";
import {
    IVY_MINT,
    GAME_DECIMALS,
    getAssociatedTokenAddressSync,
} from "@/import/ivy-sdk";
import { Api } from "./api";
import { Jup, JupiterOrderResponse } from "./jup";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

/// The maximum Jupiter TX size in bytes
const MAX_JUP_TX_SIZE = 950;

/// Fetch an ExactIn order from Jupiter
/// The `user` must have the required `inAmountRaw`
/// tokens, or this function will fail.
async function fetchJupiterExactIn(
    user: PublicKey | undefined,
    inputToken: PublicKey,
    outputToken: PublicKey,
    inAmountRaw: number,
    slippageBps: number,
) {
    let orderResponse: JupiterOrderResponse;
    // When composing mixed transactions,
    // the maximum total # of unique accounts used is 18.
    // So, Jupiter can technically use up to 46
    // accounts before hitting the max of 64 locked per tx.
    // But, this results in us frequently exceeding the
    // 1232 byte limit after the Ivy stuff is added.
    // (Also, at least while we're still waiting on
    // Blowfish to approve our application, we have to leave
    // space for Lighthouse assertions, or else users will
    // receive the dangerous dApp warning.)
    // So, we'll be conservative and limit Jupiter
    // to 32 accounts, so we have a comfortable buffer
    // of space.
    let maxAccounts = 32;
    while (true) {
        orderResponse = await Jup.fetchOrder(
            inputToken,
            outputToken,
            inAmountRaw,
            slippageBps,
            {
                swapMode: "ExactIn",
                onlyDirectRoutes: false,
                asLegacyTransaction: false,
                minimizeSlippage: false,
                maxAccounts,
                taker: user ? user.toBase58() : undefined,
                // only support Metis (jupiter aggregator v6)
                excludeRouters: [
                    "jupiterz",
                    "hashflow",
                    "dflow",
                    "pyth",
                    "okx",
                ],
                // for some reason, Obric V2 fails in all transactions
                // with the error "Rejected". so, we won't use it here
                excludeDexes: ["Obric V2"],
            },
        );
        if (
            !orderResponse.transaction ||
            orderResponse.transaction.length <
                Math.ceil(MAX_JUP_TX_SIZE * (4 / 3))
        ) {
            break;
        }
        // try again, sometimes tx goes outside limits anyway!
        // so we've got to make sure it's within our bounds
        // (decrease max accounts as we keep going to ensure
        // we get a different route that's closer to our goal)
        maxAccounts -= 2;
        if (maxAccounts < 2) {
            throw new Error(
                "can't find good jup route, already decreased max accounts to 2...",
            );
        }
    }

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

// Binance 3, ~891M USDC
const BIG_USDC_HOLDER = new PublicKey(
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);
const BIG_USDC_HOLDER_B58 = BIG_USDC_HOLDER.toBase58();
const BIG_USDC_TOKEN_ACCOUNT_B58 = getAssociatedTokenAddressSync(
    USDC_MINT,
    BIG_USDC_HOLDER,
).toBase58();
const BIG_USDC_WSOL_ACCOUNT = getAssociatedTokenAddressSync(
    WSOL_MINT,
    BIG_USDC_HOLDER,
);
const BIG_USDC_WSOL_ACCOUNT_B58 = BIG_USDC_WSOL_ACCOUNT.toBase58();

/// Transforms a Jupiter transaction message that has been constructed
/// with `BIG_USDC_HOLDER` as the user to have `user` as the user.
///
/// Why do we need to do this? When creating a transaction,
/// Jupiter requires the provided user to have the input token amount
/// that they're swapping in their wallet.
///
/// This is problematic when trying to create transactions along the lines of
/// GAME -> IVY -> USDC -> *, because when we request the USDC -> * leg of the
/// journey from Jupiter, an error will be returned since the user doesn't
/// actually have the required USDC.
///
/// To solve this issue, we:
/// - 1. Use `BIG_USDC_HOLDER` as our user when fetching the order.
/// - 2. Analyze all `closeAccount` instructions created by Jupiter,
///      collecting the accounts for `BIG_USDC_HOLDER` and computing
///      equivalents for our `user`.
/// - 3. Remove all `createAccount` instructions created by Jupiter.
///      We choose to use information from `closeAccount` because
///      there's a chance that `BIG_USDC_HOLDER` might already have
///      accounts that Jupiter needs, resulting in there being less
///      `createAccount`s than are necessary for the `user`.
///      This algorithm will still break if Jupiter uses a
///      `BIG_USDC_HOLDER` account without either creating or closing it,
///      but our hope is that this will not happen.
///      (So far, I have only observed Jupiter creating/deleting `WSOL`
///      accounts and the destination token account.)
/// - 4. Loop through all remaining instructions and replace all
///      collected `BIG_USDC_HOLDER` token accounts with their equivalent
///      for `user`.
/// - 5. Where the `createAccount` instructions used to be, insert
///      `CreateAssociatedTokenAccountIdempotent` instructions for
///      each token observed in `closeAccount` as well as the destination
///      token.
function transformMessage(
    msg: TransactionMessage,
    user: PublicKey,
    mint: PublicKey,
) {
    const userMintAccount = getAssociatedTokenAddressSync(mint, user);
    const userWsolAccount = getAssociatedTokenAddressSync(WSOL_MINT, user);
    const accountMap: Record<string, PublicKey | undefined> = {
        [BIG_USDC_HOLDER_B58]: user,
        [BIG_USDC_TOKEN_ACCOUNT_B58]: getAssociatedTokenAddressSync(
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
            if (!account.pubkey.equals(BIG_USDC_WSOL_ACCOUNT)) {
                throw new Error(
                    "Jupiter instruction closes unknown token account: only WSOL is supported by this algorithm",
                );
            }
            requiresWsol = true;
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
): Promise<
    Quote & {
        txBase64: string | null;
        transformMessage: (msg: TransactionMessage) => void;
    }
> {
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
            transformMessage: () => {},
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
            transformMessage: () => {},
        };
    }

    // GAME -> IVY -> USDC -> *
    // First hop: GAME -> IVY
    const ivyQuote = await Api.getGameQuote(game, inputRaw, false);

    // Second hop: IVY -> USDC
    const usdcQuote = await Api.getIvyQuote(ivyQuote.output_amount, false);

    // Third hop: USDC -> * through Jupiter (requires transformation)
    // Get Jupiter quote and token price concurrently
    const [jupiterQuote, outputTokenPrices] = await Promise.all([
        fetchJupiterExactIn(
            user ? BIG_USDC_HOLDER : undefined,
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
        transformMessage: user
            ? (msg) => transformMessage(msg, user, outputToken)
            : () => {},
    };
}

export async function fetchBuyIvyQuote(
    user: PublicKey | undefined,
    inputToken: PublicKey,
    inputAmount: number,
    inputDecimals: number,
    slippageBps: number,
): Promise<
    Quote & {
        txBase64: string | null;
    }
> {
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
): Promise<
    Quote & {
        txBase64: string | null;
        transformMessage: (msg: TransactionMessage) => void;
    }
> {
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
            transformMessage: () => {},
        };
    } else {
        // IVY -> USDC -> * (via Jupiter for second hop)
        // First hop: IVY -> USDC
        const usdcQuote = await Api.getIvyQuote(inputRaw, false);

        // Second hop: USDC -> * (requires transformation)
        const [jupiterQuote, outputTokenPrices] = await Promise.all([
            fetchJupiterExactIn(
                user ? BIG_USDC_HOLDER : undefined,
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
            transformMessage: user
                ? (msg) => transformMessage(msg, user, outputToken)
                : () => {},
        };
    }
}
