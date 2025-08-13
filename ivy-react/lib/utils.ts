import {
    ComputeBudgetProgram,
    PublicKey,
    Transaction,
    VersionedTransaction,
} from "@solana/web3.js";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Api, Context } from "./api";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function unwrap<T>(x: T | null | undefined, msg: string): T {
    if (x === null || x === undefined) {
        throw new Error(msg);
    }
    return x;
}

export function sfcap(value: number, significantFigures: number) {
    const floored = Math.floor(value);
    const decimals = significantFigures - floored.toString().length;
    if (decimals < 0) {
        // strip decimals, but don't truncate whole part
        return floored;
    }
    const factor = Math.pow(10, decimals);
    const result = Math.floor(value * factor) / factor;
    return result;
}

/**
 * Creates a new `Promise` that calls `f` infinitely with
 * exponential backoff, reporting errors to the console and
 * returning only upon success.
 *
 * @param f Function that returns a Promise to be retried
 * @param desc Description of operation to be performed
 * @param continue_ Function that determines whether to continue retrying (returns true) or stop silently (returns false)
 * @returns Promise that resolves when f succeeds, or never resolves if continue returns false
 */
export function infinitely<T>(
    f: () => Promise<T>,
    desc: string,
    continue_: () => boolean,
): Promise<T> {
    return new Promise<T>((resolve) => {
        const initialDelayMs = 500;
        const maxDelayMs = 60 * 1000; // 1 minute max delay

        // Function to attempt execution with exponential backoff
        const attempt = (delayMs: number): void => {
            // Check if we should continue trying
            if (!continue_()) {
                // Return silently without resolving if we shouldn't continue
                return;
            }

            f()
                .then((x) => {
                    if (!continue_()) {
                        return;
                    }
                    resolve(x);
                })
                .catch((error) => {
                    console.error("failed to " + desc, error);

                    // Calculate next delay with exponential backoff
                    const nextDelay = Math.min(delayMs * 2, maxDelayMs);

                    // Schedule next attempt
                    setTimeout(() => attempt(nextDelay), delayMs);
                });
        };

        // Start first attempt immediately
        attempt(initialDelayMs);
    });
}
export const PROCESS_TRANSACTION_RETRIEVING = 0;
export const PROCESS_TRANSACTION_SIGNING = 1;
export const PROCESS_TRANSACTION_SENDING = 2;
export const PROCESS_TRANSACTION_CONFIRMING = 3;

function pushU64LE(target: number[], value: number) {
    for (let i = 0; i < 8; i++) {
        target.push(value & 0xff);
        value = Math.floor(value / 256); // safe shr by 8
    }
}

/**
 * Process an unsigned transaction by applying the priority fee,
 * signing it, submitting it to the blockchain, and confirming it.
 *
 * @param insName The Ivy instruction name that's being invoked
 * @param tx The `Transaction`, `VersionedTransaction`, `Promise<Transaction>`, or `Promise<VersionedTransaction>` to complete.
 * @param user The fee payer for this transaction (only applied if `tx` is a `Transaction` or `Promise<Transaction>`).
 * @param signTransaction The original `signTransaction` method provided by the wallet object.
 * @param onStatus A callback, will be called with the `PROCESS_TRANSACTION_*` constants when the status changes.
 */
export async function processTransaction(
    insName: string,
    tx:
        | Transaction
        | VersionedTransaction
        | Promise<Transaction | VersionedTransaction>,
    user: PublicKey,
    signTransaction: (
        tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>,
    onStatus: (status: number) => void,
    confirmFn?: (
        signature: string,
        lastValidBlockHeight: number,
    ) => Promise<void>,
): Promise<string> {
    // 1) Fetch both the context and the transaction
    onStatus(PROCESS_TRANSACTION_RETRIEVING);
    const ctxPromise = Api.getContext(insName);
    let ctx: Context;
    if (tx instanceof Promise) {
        [ctx, tx] = await Promise.all([ctxPromise, tx]);
    }
    ctx = await ctxPromise;

    // 2) Apply the context
    const previousSignatures: Uint8Array[] = [];
    if (tx instanceof Transaction) {
        tx.recentBlockhash = ctx.blockhash;
        tx.lastValidBlockHeight = ctx.lastValidBlockHeight;
        tx.feePayer = user;
        let existingBudgetIx = false;
        for (const ins of tx.instructions) {
            if (
                ins.programId.equals(ComputeBudgetProgram.programId) &&
                ins.data.length > 0 &&
                ins.data[0] === 3 // SetComputeUnitPrice
            ) {
                existingBudgetIx = true;
                // Update the existing instruction with the new priority fee
                const data = [3]; // SetComputeUnitPrice
                pushU64LE(data, ctx.reasonablePriorityFee);
                ins.data = Buffer.from(data);
                break;
            }
        }
        if (!existingBudgetIx && ctx.reasonablePriorityFee > 0) {
            tx.instructions.unshift(
                ComputeBudgetProgram.setComputeUnitPrice({
                    microLamports: ctx.reasonablePriorityFee,
                }),
            );
        }
    } else {
        let cbpIndex = tx.message.staticAccountKeys.findIndex((x) =>
            x.equals(ComputeBudgetProgram.programId),
        );
        let existingBudgetIx = false;
        if (cbpIndex >= 0) {
            for (const ins of tx.message.compiledInstructions) {
                if (
                    ins.programIdIndex === cbpIndex &&
                    ins.data.length > 0 &&
                    ins.data[0] === 3 // SetComputeUnitPrice
                ) {
                    existingBudgetIx = true;
                    // Update the existing instruction with the new priority fee
                    const data = [3]; // SetComputeUnitPrice
                    pushU64LE(data, ctx.reasonablePriorityFee);
                    ins.data = Uint8Array.from(data);
                    break;
                }
            }
        }
        if (!existingBudgetIx && ctx.reasonablePriorityFee > 0) {
            if (cbpIndex < 0) {
                // The compute budget program does not exist in the given
                // versioned transaction. Thus, we must include it. Our strategy:
                // we will append it to the end of the `staticAccountKeys` list.
                // Then, we must patch the transactions: any index greater than or equal to
                // `cbpIndex` should be shifted one to the right, because in the global list,
                // static account keys come first and everything else comes after.
                cbpIndex = tx.message.staticAccountKeys.length;
                tx.message.staticAccountKeys.push(
                    ComputeBudgetProgram.programId,
                );
                for (const ci of tx.message.compiledInstructions) {
                    const aki = ci.accountKeyIndexes;
                    for (let i = 0; i < aki.length; i++) {
                        if (aki[i] >= cbpIndex) {
                            aki[i]++;
                        }
                    }
                    if (ci.programIdIndex >= cbpIndex) {
                        ci.programIdIndex++;
                    }
                }
            }

            // Construct compute budget program data
            const data = [3]; // SetComputeUnitPrice
            pushU64LE(data, ctx.reasonablePriorityFee);

            // Add SetComputeUnitPrice instruction
            tx.message.compiledInstructions.unshift({
                programIdIndex: cbpIndex,
                accountKeyIndexes: [],
                data: Uint8Array.from(data),
            });
        }
        tx.message.recentBlockhash = ctx.blockhash;
        previousSignatures.push(...tx.signatures);
    }

    // 3) Sign and send the transaction
    let signature: string;
    const w = window as {
        phantom?: {
            solana?: {
                isPhantom: boolean;
                signAndSendTransaction: (
                    tx: Transaction | VersionedTransaction,
                ) => Promise<{
                    signature: string;
                }>;
            };
        };
    };
    const host = window.location.hostname;
    if (
        host !== "127.0.0.1" &&
        host !== "localhost" &&
        w.phantom?.solana?.isPhantom
    ) {
        // We're using Phantom, let's use their special fn
        onStatus(PROCESS_TRANSACTION_SENDING);
        const result = await w.phantom.solana.signAndSendTransaction(tx);
        signature = result.signature;
    } else {
        onStatus(PROCESS_TRANSACTION_SIGNING);
        const txSigned = await signTransaction(tx);
        if (txSigned instanceof VersionedTransaction) {
            txSigned.signatures = txSigned.signatures.filter((s) => {
                for (const p of previousSignatures) {
                    if (p.length !== s.length) {
                        continue;
                    }
                    let eq = true;
                    for (let i = 0; i < p.length; i++) {
                        if (p[i] !== s[i]) {
                            eq = false;
                            break;
                        }
                    }
                    if (eq) {
                        return false;
                    }
                }
                return true;
            });
        }
        onStatus(PROCESS_TRANSACTION_SENDING);
        signature = await Api.sendTransaction(txSigned);
    }

    // 4) Confirm the transaction
    onStatus(PROCESS_TRANSACTION_CONFIRMING);
    confirmFn ||= Api.confirmTransaction;
    await confirmFn(signature, ctx.lastValidBlockHeight);

    // 5) We're finished!
    return signature;
}
