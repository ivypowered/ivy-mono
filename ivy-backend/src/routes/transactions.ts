import { z } from "zod";
import { Request } from "express";
import { Deps } from "../types/deps";
import {
    AddressLookupTableAccount,
    CompiledInstruction,
    Keypair,
    MessageCompiledInstruction,
    PublicKey,
    SendTransactionError,
    Transaction,
    TransactionInstruction,
    VersionedTransaction,
} from "@solana/web3.js";
import { IVY_PROGRAM_ID, getIvyInstructionName } from "ivy-sdk";
import { confirmTransaction as confirmTx } from "../functions/confirmTransaction";
import { parsePublicKey } from "../utils/requestHelpers";
import { getEffects } from "../functions/getEffects";

const sendSchema = z.object({
    tx_base64: z.string(),
});

export const sendTransaction = ({ connection, priorityFeeService }: Deps) => async (req: Request) => {
    const { tx_base64 } = sendSchema.parse(req.body);

    const txBytes = Buffer.from(tx_base64, "base64");

    let tx: Transaction | VersionedTransaction;
    try {
        tx = VersionedTransaction.deserialize(txBytes);
    } catch (_) {
        tx = Transaction.from(txBytes);
    }

    let insData: Uint8Array;
    if (tx instanceof Transaction) {
        let ivyInstruction: TransactionInstruction | null = null;
        for (const ins of tx.instructions) {
            if (ins.programId.equals(IVY_PROGRAM_ID)) {
                ivyInstruction = ins;
                break;
            }
        }
        if (!ivyInstruction) {
            throw new Error("could not find Ivy program in given instructions");
        }
        insData = ivyInstruction.data as Uint8Array;
    } else {
        const ivyIndex = tx.message.staticAccountKeys.findIndex((x) =>
            x.equals(IVY_PROGRAM_ID),
        );
        if (ivyIndex < 0) {
            throw new Error("can't find Ivy program in given transaction");
        }
        let ivyInstruction: MessageCompiledInstruction | null = null;
        for (const ins of tx.message.compiledInstructions) {
            if (ins.programIdIndex === ivyIndex) {
                ivyInstruction = ins;
                break;
            }
        }
        if (!ivyInstruction) {
            throw new Error("can't find Ivy instruction");
        }
        insData = ivyInstruction.data;
    }
    const insName = getIvyInstructionName(insData);
    if (!insName) {
        throw new Error(
            "can't deserialize Ivy instruction name: " +
                JSON.stringify(Array.from(insData)),
        );
    }
    if (priorityFeeService) {
        // give data to priority fee service
        priorityFeeService.provide(insName, tx_base64);
    }

    let signature: string;
    try {
        signature = await connection.sendEncodedTransaction(tx_base64, {
            preflightCommitment: connection.commitment,
        });
    } catch (e) {
        if (!(e instanceof SendTransactionError)) {
            throw new Error("can't send tx: " + String(e));
        }
        let logs = "";
        try {
            logs = JSON.stringify(await e.getLogs(connection), null, 4);
        } catch (_e) {}
        throw new Error(
            `${e.transactionError.message}${logs ? `\nLogs: ${logs}` : ""} `,
        );
    }

    return { signature };
};

const confirmParamsSchema = z.object({
    signature: z.string(),
});
const confirmQuerySchema = z.object({
    lastValidBlockHeight: z.string(),
});

export const confirmTransactionRoute = ({ connection }: Deps) => async (
    req: Request,
) => {
    const { signature } = confirmParamsSchema.parse(req.params);
    const { lastValidBlockHeight } = confirmQuerySchema.parse(req.query);

    const block_height = parseInt(lastValidBlockHeight);
    if (isNaN(block_height)) {
        throw new Error("lastValidBlockHeight must be a valid number");
    }

    await confirmTx(connection, signature, block_height);
    return null;
};

const effectsParamsSchema = z.object({
    signature: z.string(),
});
const effectsQuerySchema = z.object({
    inputMint: z.string(),
    outputMint: z.string(),
    lastValidBlockHeight: z.string().optional(),
});

export const getTransactionEffects = ({ connection }: Deps) => async (
    req: Request,
) => {
    const { signature } = effectsParamsSchema.parse(req.params);
    const { inputMint: inputMintStr, outputMint: outputMintStr, lastValidBlockHeight } =
        effectsQuerySchema.parse(req.query);

    const inputMint = parsePublicKey(inputMintStr, "inputMint");
    const outputMint = parsePublicKey(outputMintStr, "outputMint");
    let lvh: number | undefined = undefined;
    if (lastValidBlockHeight) {
        lvh = parseInt(lastValidBlockHeight);
        if (isNaN(lvh)) {
            throw new Error("lastValidBlockHeight must be a valid number");
        }
    }

    const { inputRaw, outputRaw } = await getEffects(
        connection,
        signature,
        inputMint,
        outputMint,
        lvh,
    );

    return { inputRaw, outputRaw };
};
