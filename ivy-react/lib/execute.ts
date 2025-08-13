// ivy-react/lib/execute.ts
import {
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    PublicKey,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import {
    JUP_IX_ROUTE_TAG,
    JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG,
    JUP_PROGRAM_ID,
    USDC_MINT,
} from "./constants";
import { Api } from "./api";
import {
    Game,
    GAME_DECIMALS,
    IVY_DECIMALS,
    IVY_MINT,
    Mix,
    World,
} from "@/import/ivy-sdk";
import { Jup, JupiterQuoteResponse } from "./jup";

export type ExecuteResponse = {
    insName: string;
    getTx: () => Promise<Transaction | VersionedTransaction>;
};

/**
 * Converts an amount to raw value based on decimals
 */
function toRaw(amount: number, decimals: number): string {
    return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Helper function to fetch and create Address Lookup Table accounts
 */
async function fetchAltAccounts(
    altKeys: PublicKey[],
): Promise<AddressLookupTableAccount[]> {
    const altData = await Api.getAccountsData(altKeys);
    return altKeys.map((key, i) => {
        const data = altData[i];
        if (!data) throw new Error("Can't find ALT " + key.toBase58());
        return new AddressLookupTableAccount({
            key,
            state: AddressLookupTableAccount.deserialize(data),
        });
    });
}

// Binance 3, ~891M USDC
const BIG_USDC_HOLDER = new PublicKey(
    "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
);

async function getPatchedJupiterTransaction(
    alt: PublicKey | null,
    jupiterUser: PublicKey, // who to build the Jupiter swap for
    quoteResponse: JupiterQuoteResponse,
    patch: (ix: TransactionInstruction) => Promise<TransactionInstruction[]>,
    additionalComputeUnits: number,
    transformMessage: (msg: TransactionMessage) => void,
    useWorldAlt: boolean,
): Promise<VersionedTransaction> {
    // Build the Jupiter swap from the quote
    const { swapTransaction } = await Jup.buildSwap(
        jupiterUser,
        quoteResponse,
        {
            wrapAndUnwrapSol: false, // match previous useWsol=false behavior
            asLegacyTransaction: false,
            dynamicComputeUnitLimit: true,
        },
    );

    const tx = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, "base64"),
    );

    // Resolve ALTs: all Jupiter ALTs + optional extra ALT(s) we need to compose with
    const altKeys = tx.message.addressTableLookups.map((x) => x.accountKey);
    if (alt) {
        altKeys.push(alt);
    }
    let altAccounts: AddressLookupTableAccount[];
    if (!useWorldAlt) {
        altAccounts = await fetchAltAccounts(altKeys);
    } else {
        const [altAccountsPre, worldAlt] = await Promise.all([
            fetchAltAccounts(altKeys),
            Api.getWorldAlt(),
        ]);
        altAccountsPre.push(worldAlt);
        altAccounts = altAccountsPre;
    }

    // Decompile using only the ALTs Jupiter included in its message
    const message = TransactionMessage.decompile(tx.message, {
        addressLookupTableAccounts: altAccounts.slice(
            0,
            tx.message.addressTableLookups.length,
        ),
    });

    // Transform the message (e.g. BIG_USDC_HOLDER -> user, inject ATAs, etc.)
    transformMessage(message);

    // Find Jupiter route/shared_accounts_route instruction to patch
    const jupInstructionIndex = message.instructions.findIndex(
        (ix) =>
            ix.programId.equals(JUP_PROGRAM_ID) &&
            ix.data.length >= 8 &&
            (JUP_IX_ROUTE_TAG.equals(ix.data.subarray(0, 8)) ||
                JUP_IX_SHARED_ACCOUNTS_ROUTE_TAG.equals(
                    ix.data.subarray(0, 8),
                )),
    );
    if (jupInstructionIndex < 0) {
        throw new Error("can't find jup route instruction index");
    }
    const jupInstruction = message.instructions[jupInstructionIndex];
    const patchedInstructions = await patch(jupInstruction);

    message.instructions = [
        ...message.instructions.slice(0, jupInstructionIndex),
        ...patchedInstructions,
        ...message.instructions.slice(jupInstructionIndex + 1),
    ];

    // Increase compute unit limit to account for our additional work
    for (const ins of message.instructions) {
        if (
            !ins.programId.equals(ComputeBudgetProgram.programId) ||
            ins.data.length < 5 ||
            ins.data[0] !== 2 // SetComputeUnitLimit
        ) {
            continue;
        }
        const prevLimit = ins.data.readUint32LE(1);
        const curLimit = prevLimit + additionalComputeUnits;
        ins.data.writeUint32LE(curLimit, 1);
        break;
    }

    // Recompile with our combined set of ALTs (Jupiter's + optional World/extra)
    tx.message = message.compileToV0Message(altAccounts);
    return tx;
}

// How many additional compute units we think Ivy consumes:
const IVY_CU_ESTIMATE_ONLY = 80_000; // just Ivy LP
const IVY_CU_ESTIMATE_WITH_GAME = 160_000; // both Ivy LP + Game LP

/**
 * Creates a transaction to buy a specific GAME token using various input tokens
 */
export function createBuyTransaction(
    gameSwapAlt: PublicKey,
    user: PublicKey,
    game: PublicKey,
    inputToken: PublicKey,
    input: number,
    inputDecimals: number,
    minOutput: number,
    jupQuoteResponse: JupiterQuoteResponse | null,
): ExecuteResponse {
    const inputRaw = toRaw(input, inputDecimals);
    const minOutputRaw = toRaw(minOutput, GAME_DECIMALS);

    // Case 1: IVY -> GAME (direct swap)
    if (inputToken.equals(IVY_MINT)) {
        return {
            insName: "GameSwap",
            getTx: () => Game.swap(game, inputRaw, minOutputRaw, true, user),
        };
    }

    // Case 2: USDC -> IVY -> GAME
    if (inputToken.equals(USDC_MINT)) {
        return {
            insName: "MixUsdcToGame",
            getTx: () => Mix.usdcToGame(game, inputRaw, minOutputRaw, user),
        };
    }

    // Case 3: * -> USDC -> IVY -> GAME (via Jupiter for first hop)
    if (!jupQuoteResponse) {
        throw new Error(
            "Jupiter quoteResponse required for non-IVY/USDC inputs",
        );
    }

    const getTx = () =>
        getPatchedJupiterTransaction(
            gameSwapAlt,
            user, // Jupiter leg is from user's input token -> USDC
            jupQuoteResponse,
            (jupInstruction) =>
                Mix.anyToGame(
                    game,
                    minOutputRaw,
                    user,
                    jupInstruction.keys,
                    jupInstruction.data,
                ).then((tx) => tx.instructions),
            IVY_CU_ESTIMATE_WITH_GAME,
            () => {},
            false, // don't need world ALT, already have game swap ALT
        );
    return {
        insName: "MixAnyToGame",
        getTx,
    };
}

/**
 * Creates a transaction to sell a specific GAME token
 */
export function createSellTransaction(
    gameSwapAlt: PublicKey,
    user: PublicKey,
    game: PublicKey,
    outputToken: PublicKey,
    input: number,
    minOutput: number,
    outputDecimals: number,
    jupQuoteResponse: JupiterQuoteResponse | null,
    transformMessage: (msg: TransactionMessage) => void,
): ExecuteResponse {
    const inputRaw = toRaw(input, GAME_DECIMALS);
    const minOutputRaw = toRaw(minOutput, outputDecimals);

    // Case 1: GAME -> IVY (direct swap)
    if (outputToken.equals(IVY_MINT)) {
        return {
            insName: "GameSwap",
            getTx: () => Game.swap(game, inputRaw, minOutputRaw, false, user),
        };
    }

    // Case 2: GAME -> IVY -> USDC
    if (outputToken.equals(USDC_MINT)) {
        return {
            insName: "MixGameToUsdc",
            getTx: () => Mix.gameToUsdc(game, inputRaw, minOutputRaw, user),
        };
    }

    // Case 3: GAME -> IVY -> USDC -> * (via Jupiter for last hop)
    if (!jupQuoteResponse) {
        throw new Error(
            "Jupiter quoteResponse required for non-IVY/USDC outputs",
        );
    }

    const getTx = () =>
        getPatchedJupiterTransaction(
            gameSwapAlt,
            BIG_USDC_HOLDER, // Build Jupiter leg (USDC -> *) against the big holder, then transform to user
            jupQuoteResponse,
            (jupInstruction) =>
                Mix.gameToAny(
                    game,
                    inputRaw,
                    user,
                    jupInstruction.keys,
                    jupInstruction.data,
                ).then((tx) => tx.instructions),
            IVY_CU_ESTIMATE_WITH_GAME,
            transformMessage,
            false, // don't need world ALT, already have game swap ALT
        );
    return {
        insName: "MixGameToAny",
        getTx,
    };
}

/**
 * Creates a transaction to buy IVY token using various input tokens
 */
export function createBuyIvyTransaction(
    user: PublicKey,
    inputToken: PublicKey,
    input: number,
    inputDecimals: number,
    minOutput: number,
    jupQuoteResponse: JupiterQuoteResponse | null,
): ExecuteResponse {
    const inputRaw = toRaw(input, inputDecimals);
    const minOutputRaw = toRaw(minOutput, IVY_DECIMALS);

    // Case 1: USDC -> IVY (direct swap)
    if (inputToken.equals(USDC_MINT)) {
        return {
            insName: "WorldSwap",
            getTx: () => World.swap(inputRaw, minOutputRaw, true, user),
        };
    }

    // Case 2: * -> USDC -> IVY (via Jupiter for first hop)
    if (!jupQuoteResponse) {
        throw new Error("Jupiter quoteResponse required for non-USDC inputs");
    }

    const getTx = () =>
        getPatchedJupiterTransaction(
            null,
            user, // Jupiter leg is from user's input token -> USDC
            jupQuoteResponse,
            (jupInstruction) =>
                Mix.anyToIvy(
                    minOutputRaw,
                    user,
                    jupInstruction.keys,
                    jupInstruction.data,
                ).then((tx) => tx.instructions),
            IVY_CU_ESTIMATE_ONLY,
            () => {},
            true, // need world ALT
        );
    return {
        insName: "MixAnyToIvy",
        getTx,
    };
}

/**
 * Creates a transaction to sell IVY token for various output tokens
 */
export function createSellIvyTransaction(
    user: PublicKey,
    outputToken: PublicKey,
    input: number,
    minOutput: number,
    outputDecimals: number,
    jupQuoteResponse: JupiterQuoteResponse | null,
    transformMessage: (msg: TransactionMessage) => void,
): ExecuteResponse {
    const inputRaw = toRaw(input, IVY_DECIMALS);
    const minOutputRaw = toRaw(minOutput, outputDecimals);

    // Case 1: IVY -> USDC (direct swap)
    if (outputToken.equals(USDC_MINT)) {
        return {
            insName: "WorldSwap",
            getTx: () => World.swap(inputRaw, minOutputRaw, false, user),
        };
    }

    // Case 2: IVY -> USDC -> * (via Jupiter for last hop)
    if (!jupQuoteResponse) {
        throw new Error("Jupiter quoteResponse required for non-USDC outputs");
    }

    const getTx = () =>
        getPatchedJupiterTransaction(
            null,
            BIG_USDC_HOLDER, // Build Jupiter leg (USDC -> *) against the big holder, then transform to user
            jupQuoteResponse,
            (jupInstruction) =>
                Mix.ivyToAny(
                    inputRaw,
                    user,
                    jupInstruction.keys,
                    jupInstruction.data,
                ).then((tx) => tx.instructions),
            IVY_CU_ESTIMATE_ONLY,
            transformMessage,
            true, // need world ALT
        );
    return {
        insName: "MixIvyToAny",
        getTx,
    };
}
