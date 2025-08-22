import { PublicKey, TransactionMessage } from "@solana/web3.js";
import { Decimal } from "decimal.js-light";
import { Quote, SwapToken } from "@/components/swap/swapTypes";
import {
    IVY_MINT_B58,
    JUP_IX_CREATE_TOKEN_ACCOUNT_TAG,
    JUP_IX_ROUTE_TAG,
    JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
    JUP_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    USDC_MINT,
    USDC_MINT_B58,
    WSOL_MINT,
} from "@/lib/constants";
import {
    StepResult,
    useAnyToUsdc,
    useUsdcToIvy,
    useIvyToGame,
    useGameToIvy,
    useIvyToUsdc,
    useUsdcToAny,
} from "./useSteps";
import {
    createBuyIvyTransaction,
    createSellIvyTransaction,
    createBuyTransaction,
    createSellTransaction,
} from "./execute";
import { JupiterQuoteResponse } from "./jup";
import { getAssociatedTokenAddressSync } from "@/import/ivy-sdk";
import { useMemo } from "react";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";

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

export interface GameReserves {
    ivyBalance: Decimal;
    gameBalance: Decimal;
}

export interface WorldReserves {
    ivySold: Decimal;
    ivyCurveMax: Decimal;
    curveInputScale: Decimal;
}

export interface FeeConfig {
    ivyFeeBps: number;
    gameFeeBps: number;
}

interface QuoteParams {
    user: PublicKey | undefined;
    game: PublicKey;
    gameSwapAlt: PublicKey;
    gameMint: string;
    inputToken: SwapToken;
    outputToken: SwapToken;
    inputAmount: Decimal;
    outputAmount: Decimal;
    slippageBps: number;
    gameReserves: GameReserves | null;
    worldReserves: WorldReserves | null;
    feeConfig: FeeConfig | null;
    refreshKey: number;
}

export function useQuote({
    user,
    game,
    gameSwapAlt,
    gameMint,
    inputToken,
    outputToken,
    inputAmount,
    outputAmount,
    slippageBps,
    gameReserves,
    worldReserves,
    feeConfig,
    refreshKey,
}: QuoteParams): Quote | null {
    // Determine which legs are active
    let anyToUsdc = false;
    let usdcToIvy = false;
    let ivyToGame = false;
    let gameToIvy = false;
    let ivyToUsdc = false;
    let usdcToAny = false;

    const isInputGame = inputToken.mint === gameMint;
    const isOutputGame = outputToken.mint === gameMint;
    const isInputIvy = inputToken.mint === IVY_MINT_B58;
    const isOutputIvy = outputToken.mint === IVY_MINT_B58;
    const isInputUsdc = inputToken.mint === USDC_MINT_B58;
    const isOutputUsdc = outputToken.mint === USDC_MINT_B58;

    // Configure route
    if (isOutputGame) {
        // Buying game
        if (isInputIvy) {
            ivyToGame = true;
        } else if (isInputUsdc) {
            usdcToIvy = true;
            ivyToGame = true;
        } else {
            anyToUsdc = true;
            usdcToIvy = true;
            ivyToGame = true;
        }
    } else if (isInputGame) {
        // Selling game
        gameToIvy = true;
        if (!isOutputIvy) {
            ivyToUsdc = true;
            if (!isOutputUsdc) {
                usdcToAny = true;
            }
        }
    } else if (isOutputIvy) {
        // Buying IVY
        if (!isInputUsdc) {
            anyToUsdc = true;
        }
        usdcToIvy = true;
    } else if (isInputIvy) {
        // Selling IVY
        ivyToUsdc = true;
        if (!isOutputUsdc) {
            usdcToAny = true;
        }
    }

    let result: StepResult = {
        amount: inputAmount,
        priceImpactBps: 0,
        jupQuoteResponse: null,
        inputUsd: undefined, // Will be set by the first step that can calculate it
        outputUsd: undefined,
        worldReserves,
    };

    // Chain through all steps
    result = useAnyToUsdc(
        result,
        new PublicKey(inputToken.mint),
        inputToken.decimals,
        slippageBps,
        refreshKey,
        anyToUsdc,
    );

    result = useUsdcToIvy(result, usdcToIvy);

    result = useIvyToGame(result, gameReserves, feeConfig, ivyToGame);

    result = useGameToIvy(result, gameReserves, feeConfig, gameToIvy);

    result = useIvyToUsdc(result, ivyToUsdc);

    result = useUsdcToAny(
        result,
        new PublicKey(outputToken.mint),
        outputToken.decimals,
        slippageBps,
        refreshKey,
        usdcToAny,
    );

    // Create the ExecuteResponse based on the transaction type
    const executeResponse = useMemo(() => {
        if (
            !result.amount ||
            !user ||
            (outputAmount && !outputAmount.isZero())
        ) {
            return null;
        }

        const jupQuoteResponse =
            result.jupQuoteResponse as JupiterQuoteResponse | null;
        const minOutput = result.amount.mul(1 - slippageBps / 10_000);

        // Buying IVY
        if (!isInputGame && isOutputIvy) {
            return createBuyIvyTransaction(
                user,
                new PublicKey(inputToken.mint),
                inputAmount,
                inputToken.decimals,
                minOutput,
                jupQuoteResponse,
            );
        }

        // Selling IVY
        if (isInputIvy && !isOutputGame) {
            const outputMint = new PublicKey(outputToken.mint);
            return createSellIvyTransaction(
                user,
                outputMint,
                inputAmount,
                minOutput,
                outputToken.decimals,
                jupQuoteResponse,
                (msg: TransactionMessage) =>
                    transformMessage(msg, user, outputMint),
            );
        }

        // Buying game token
        if (isOutputGame) {
            return createBuyTransaction(
                gameSwapAlt,
                user,
                game,
                new PublicKey(inputToken.mint),
                inputAmount,
                inputToken.decimals,
                minOutput,
                jupQuoteResponse,
            );
        }

        // Selling game token
        if (isInputGame) {
            const outputMint = new PublicKey(outputToken.mint);
            return createSellTransaction(
                gameSwapAlt,
                user,
                game,
                outputMint,
                inputAmount,
                minOutput,
                outputToken.decimals,
                jupQuoteResponse,
                (msg: TransactionMessage) =>
                    transformMessage(msg, user, outputMint),
            );
        }

        return null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        user,
        game,
        gameSwapAlt,
        isInputGame,
        isOutputGame,
        isInputIvy,
        isOutputIvy,
        inputToken.mint,
        inputToken.decimals,
        outputToken.mint,
        outputToken.decimals,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputAmount.toString(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        outputAmount?.toString(),
        slippageBps,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        result.amount?.toString(),
        result.jupQuoteResponse,
    ]);

    return useMemo(() => {
        // Build final quote
        if (!result.amount) {
            return null;
        }

        const minOutput = result.amount.mul(1 - slippageBps / 10_000);

        return {
            input: inputAmount,
            inputUSD: result.inputUsd || inputAmount, // Use the percolated inputUsd
            maxInput: new Decimal(0),
            output: result.amount,
            outputUSD: result.outputUsd || result.amount, // Use the final outputUsd
            minOutput,
            insName: executeResponse?.insName || "",
            getTransaction:
                executeResponse?.getTx ||
                (() => {
                    throw new Error(
                        "Transaction creation requires a connected wallet",
                    );
                }),
            stops: [],
            priceImpactBps: result.priceImpactBps,
            slippageBps,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        // eslint-disable-next-line react-hooks/exhaustive-deps
        inputAmount.toString(),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        result.amount?.toString(),
        executeResponse?.insName,
    ]);
}
