import {
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    PublicKey,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import { JUP_PROGRAM_ID, USDC_MINT } from "./constants";
import { Api } from "./api";
import {
    Game,
    GAME_DECIMALS,
    IVY_DECIMALS,
    IVY_MINT,
    Mix,
    World,
} from "@/import/ivy-sdk";

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

async function getPatchedJupiterTransaction(
    user: PublicKey,
    alt: PublicKey | null,
    txBase64: string,
    patch: (ix: TransactionInstruction) => Promise<TransactionInstruction[]>,
    additionalComputeUnits: number,
): Promise<VersionedTransaction> {
    const tx = VersionedTransaction.deserialize(
        Buffer.from(txBase64, "base64"),
    );
    const altAccounts = await fetchAltAccounts([
        ...tx.message.addressTableLookups.map((x) => x.accountKey),
        ...(alt ? [alt] : []),
    ]);
    const jupAltAccounts = alt
        ? altAccounts.slice(0, altAccounts.length - 1)
        : altAccounts;
    const message = TransactionMessage.decompile(tx.message, {
        addressLookupTableAccounts: jupAltAccounts,
    });

    // Find Jupiter instruction
    const jupInstructionIndex = message.instructions.findIndex((ix) =>
        ix.programId.equals(JUP_PROGRAM_ID),
    );
    if (jupInstructionIndex < 0) {
        throw new Error("can't find jup instruction index");
    }
    const jupInstruction = message.instructions[jupInstructionIndex];
    const patchedInstructions = await patch(jupInstruction);

    message.instructions = [
        ...message.instructions.slice(0, jupInstructionIndex),
        ...patchedInstructions,
        ...message.instructions.slice(jupInstructionIndex + 1),
    ];

    // We're going to consume some additional compute units
    // because we're performing extra computation in our
    // patched instruction, and we have to account for that
    // fact since Jupiter sets a compute limit.
    for (const ins of message.instructions) {
        if (
            !ins.programId.equals(ComputeBudgetProgram.programId) ||
            ins.data.length < 5 ||
            ins.data[0] === 2 // SetComputeUnitLimit
        ) {
            continue;
        }
        const prevLimit = ins.data.readUint32LE(1);
        const curLimit = prevLimit + additionalComputeUnits;
        ins.data.writeUint32LE(curLimit, 1);
        break;
    }

    tx.message = message.compileToV0Message(altAccounts);
    return tx;
}

// How many additional compute units we think Ivy consumes when swapping.
const IVY_CU_ESTIMATE = 75_000;

/**
 * Creates a transaction to buy a specific GAME token using various input tokens
 */
export async function createBuyTransaction(
    gameSwapAlt: PublicKey,
    user: PublicKey,
    game: PublicKey,
    inputToken: PublicKey,
    input: number,
    inputDecimals: number,
    minOutput: number,
    txBase64: string | null,
): Promise<Transaction | VersionedTransaction> {
    const inputRaw = toRaw(input, inputDecimals);
    const minOutputRaw = toRaw(minOutput, GAME_DECIMALS);

    // Case 1: IVY -> GAME (direct swap)
    if (inputToken.equals(IVY_MINT)) {
        // Simple direct swap from IVY to GAME
        return await Game.swap(game, inputRaw, minOutputRaw, true, user);
    }

    // Case 2: USDC -> IVY -> GAME
    if (inputToken.equals(USDC_MINT)) {
        return await Mix.usdcToGame(game, inputRaw, minOutputRaw, user);
    }

    // Case 3: * -> USDC -> IVY -> GAME
    if (!txBase64) {
        throw new Error("Jupiter txBase64 required for non-IVY/USDC inputs");
    }
    return getPatchedJupiterTransaction(
        user,
        gameSwapAlt,
        txBase64,
        (jupInstruction) =>
            Mix.anyToGame(
                game,
                minOutputRaw,
                user,
                jupInstruction.keys,
                jupInstruction.data,
            ).then((tx) => tx.instructions),
        IVY_CU_ESTIMATE,
    );
}

/**
 * Creates a transaction to sell a specific GAME token
 */
export async function createSellTransaction(
    gameSwapAlt: PublicKey,
    user: PublicKey,
    game: PublicKey,
    outputToken: PublicKey,
    input: number,
    minOutput: number,
    outputDecimals: number,
    txBase64: string | null,
): Promise<Transaction | VersionedTransaction> {
    const inputRaw = toRaw(input, GAME_DECIMALS);
    const minOutputRaw = toRaw(minOutput, outputDecimals);

    // Case 1: GAME -> IVY (direct swap)
    if (outputToken.equals(IVY_MINT)) {
        // Simple direct swap from GAME to IVY
        return await Game.swap(game, inputRaw, minOutputRaw, false, user);
    }

    // Case 2: GAME -> IVY -> USDC
    if (outputToken.equals(USDC_MINT)) {
        return await Mix.gameToUsdc(game, inputRaw, minOutputRaw, user);
    }

    // Case 3: GAME -> Any token via Jupiter
    if (!txBase64) {
        throw new Error("Jupiter txBase64 required for non-IVY/USDC outputs");
    }

    return getPatchedJupiterTransaction(
        user,
        gameSwapAlt,
        txBase64,
        (jupInstruction) =>
            Mix.gameToAny(
                game,
                inputRaw,
                user,
                jupInstruction.keys,
                jupInstruction.data,
            ).then((tx) => tx.instructions),
        IVY_CU_ESTIMATE,
    );
}

/**
 * Creates a transaction to buy IVY token using various input tokens
 */
export async function createBuyIvyTransaction(
    user: PublicKey,
    inputToken: PublicKey,
    input: number,
    inputDecimals: number,
    minOutput: number,
    txBase64: string | null,
): Promise<Transaction | VersionedTransaction> {
    const inputRaw = toRaw(input, inputDecimals);
    const minOutputRaw = toRaw(minOutput, IVY_DECIMALS);

    // Case 1: USDC -> IVY (direct swap)
    if (inputToken.equals(USDC_MINT)) {
        // Direct world swap from USDC to IVY
        return await World.swap(inputRaw, minOutputRaw, true, user);
    }

    // Case 2: * -> IVY via Jupiter
    if (!txBase64) {
        throw new Error("Jupiter txBase64 required for non-USDC inputs");
    }

    return getPatchedJupiterTransaction(
        user,
        null,
        txBase64,
        (jupInstruction) =>
            Mix.anyToIvy(
                minOutputRaw,
                user,
                jupInstruction.keys,
                jupInstruction.data,
            ).then((tx) => tx.instructions),
        IVY_CU_ESTIMATE,
    );
}

/**
 * Creates a transaction to sell IVY token for various output tokens
 */
export async function createSellIvyTransaction(
    user: PublicKey,
    outputToken: PublicKey,
    input: number,
    minOutput: number,
    outputDecimals: number,
    txBase64: string | null,
): Promise<Transaction | VersionedTransaction> {
    const inputRaw = toRaw(input, IVY_DECIMALS);
    const minOutputRaw = toRaw(minOutput, outputDecimals);

    // Case 1: IVY -> USDC (direct swap)
    if (outputToken.equals(USDC_MINT)) {
        // Direct world swap from IVY to USDC
        return await World.swap(inputRaw, minOutputRaw, false, user);
    }

    // Case 2: IVY -> Any token via Jupiter
    if (!txBase64) {
        throw new Error("Jupiter txBase64 required for non-USDC outputs");
    }

    return getPatchedJupiterTransaction(
        user,
        null,
        txBase64,
        (jupInstruction) =>
            Mix.ivyToAny(
                inputRaw,
                user,
                jupInstruction.keys,
                jupInstruction.data,
            ).then((tx) => tx.instructions),
        IVY_CU_ESTIMATE,
    );
}
