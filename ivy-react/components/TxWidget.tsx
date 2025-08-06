"use client";

import { useEffect, useMemo } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useWallet } from "@/components/wallet/WalletProvider";
import {
    PROCESS_TRANSACTION_CONFIRMING,
    PROCESS_TRANSACTION_RETRIEVING,
    PROCESS_TRANSACTION_SENDING,
    PROCESS_TRANSACTION_SIGNING,
    processTransaction,
} from "@/lib/utils";

// Transaction Status Enum
enum TransactionStatus {
    WALLET_NEEDED = "wallet_needed",
    READY = "ready",
    SIGNING = "signing",
    SENDING = "sending",
    CONFIRMING = "confirming",
    RECEIVING = "receiving",
}

// Interfaces
export interface TransactionData {
    tx: {
        base64: string;
        feePayer: string;
        derived: {
            seeds: string[];
            programId: string;
        }[];
    };
    returnUrl: string;
    returnParams: Record<string, unknown>;
    onSuccess?: string;
}

// Global state variables
let currentStatus = TransactionStatus.WALLET_NEEDED;
let currentError: string | null = null;

// Get transaction data from the DOM
function getTransactionData(button_id: string): TransactionData {
    const container = document.getElementById(button_id);
    if (!container?.dataset.transaction) {
        throw new Error("Can't find transaction dataset");
    }
    let txData: TransactionData;
    try {
        txData = JSON.parse(
            Buffer.from(container.dataset.transaction, "base64").toString(
                "utf-8",
            ),
        ) as TransactionData;
    } catch (e) {
        throw new Error(`Failed to parse transaction data: ${e}`);
    }
    if (typeof txData !== "object" || txData === null) {
        throw new Error(`Transaction data is not an object: ${txData}`);
    }
    if (typeof txData.tx !== "object" || txData.tx === null) {
        throw new Error(
            `Transaction data 'tx' field is not an object: ${JSON.stringify(txData)}`,
        );
    }
    if (typeof txData.tx.base64 !== "string") {
        throw new Error(
            `Transaction data 'base64' field is not a string: ${JSON.stringify(txData)}`,
        );
    }
    if (typeof txData.tx.feePayer !== "string") {
        throw new Error(
            `Transaction data 'feePayer' field is not a string: ${JSON.stringify(txData)}`,
        );
    }
    if (typeof txData.returnUrl !== "string") {
        throw new Error(
            `Transaction data 'returnUrl' field is not a string: ${JSON.stringify(txData)}`,
        );
    }
    if (
        typeof txData.returnParams !== "object" ||
        txData.returnParams === null
    ) {
        throw new Error(
            `Transaction data 'returnParams' field is not an object: ${JSON.stringify(txData)}`,
        );
    }
    return txData;
}

// Function to update button state
function updateButtonState(
    status: TransactionStatus,
    error: string | null = null,
    button_id: string,
): void {
    const buttonElement = document.getElementById(button_id);
    if (!buttonElement) return;

    currentStatus = status;
    currentError = error;

    // Text based on status
    const buttonTexts = {
        [TransactionStatus.WALLET_NEEDED]: "Connect Wallet",
        [TransactionStatus.READY]: "Submit Transaction",
        [TransactionStatus.SIGNING]: "Signing...",
        [TransactionStatus.SENDING]: "Sending...",
        [TransactionStatus.CONFIRMING]: "Confirming...",
        [TransactionStatus.RECEIVING]: "Receiving...",
    };

    buttonElement.innerText = buttonTexts[status] || "Submit Transaction";

    // Disable during processing states
    const isProcessing = [
        TransactionStatus.RECEIVING,
        TransactionStatus.SIGNING,
        TransactionStatus.SENDING,
        TransactionStatus.CONFIRMING,
    ].includes(status);

    (buttonElement as HTMLButtonElement).disabled = isProcessing;
    if (isProcessing) {
        buttonElement.classList.add("disabled");
    } else {
        buttonElement.classList.remove("disabled");
    }
}

// Transaction handler component
interface TransactionHandlerProps {
    button_id: string;
}
export function TxWidget({ button_id }: TransactionHandlerProps) {
    const { connected, publicKey, signTransaction, openModal } = useWallet();
    const txData = useMemo(() => getTransactionData(button_id), [button_id]);

    // Initialize button click handler
    useEffect(() => {
        const buttonElement = document.getElementById(button_id);
        if (!buttonElement) throw new Error("can't find button");

        const handleClick = () => {
            if (currentStatus === TransactionStatus.WALLET_NEEDED) {
                openModal();
            } else if (currentStatus === TransactionStatus.READY) {
                executeTransaction();
            }
        };

        buttonElement.addEventListener("click", handleClick);
        return () => buttonElement.removeEventListener("click", handleClick);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicKey, button_id]); // we MUST do this, otherwise evt handler will hold onto old version of wallet!

    // React to wallet connection changes
    useEffect(() => {
        updateButtonState(
            connected
                ? TransactionStatus.READY
                : TransactionStatus.WALLET_NEEDED,
            null,
            button_id,
        );
    }, [connected, button_id]);

    const executeTransaction = async (): Promise<void> => {
        // Early validation check
        if (
            !(currentStatus === TransactionStatus.READY) ||
            !connected ||
            !publicKey ||
            !signTransaction
        ) {
            console.error("Transaction prerequisites not met:", {
                currentStatus,
                connected,
                publicKey: !!publicKey,
                signTransaction: !!signTransaction,
            });
            return;
        }

        try {
            updateButtonState(TransactionStatus.SIGNING, null, button_id);

            // Decode transaction from base64
            const txBuffer = Buffer.from(txData.tx.base64, "base64");

            // Try to deserialize as VersionedTransaction first, then as regular Transaction
            let tx: Transaction | VersionedTransaction;
            try {
                tx = VersionedTransaction.deserialize(txBuffer);
            } catch (e0) {
                try {
                    tx = Transaction.from(txBuffer);
                } catch (e1) {
                    throw new Error(
                        "couldn't deserialize tx: " +
                            "not as VersionedTransaction (" +
                            String(e0) +
                            ") nor as Transaction (" +
                            String(e1) +
                            ")\n",
                    );
                }
            }

            // Calculate PDAs with replaced public keys
            const originalUserPubkey = new PublicKey(txData.tx.feePayer);

            const newDerived = txData.tx.derived.map((item) => {
                const seeds = item.seeds.map((seed) =>
                    (seed === txData.tx.feePayer
                        ? publicKey
                        : new PublicKey(seed)
                    ).toBuffer(),
                );
                return PublicKey.findProgramAddressSync(
                    seeds,
                    new PublicKey(item.programId),
                )[0];
            });

            const oldDerived = txData.tx.derived.map((item) => {
                const seeds = item.seeds.map((seed) =>
                    new PublicKey(seed).toBuffer(),
                );
                return PublicKey.findProgramAddressSync(
                    seeds,
                    new PublicKey(item.programId),
                )[0];
            });

            // Update transaction with current user's public key
            if (tx instanceof Transaction) {
                // Update instructions with the current wallet and PDAs
                tx.instructions.forEach((instruction) => {
                    instruction.keys.forEach((key) => {
                        if (key.pubkey.equals(originalUserPubkey)) {
                            key.pubkey = publicKey;
                            return;
                        }

                        for (let i = 0; i < oldDerived.length; i++) {
                            if (key.pubkey.equals(oldDerived[i])) {
                                key.pubkey = newDerived[i];
                                break;
                            }
                        }
                    });
                });

                // Clear signatures
                tx.signatures = [];

                // Set fee payer
                tx.feePayer = publicKey;
            } else {
                // Update versioned transaction accounts
                // Ignore ALTs (their addresses wouldn't be user-dependent)
                const keys = tx.message.staticAccountKeys;
                for (let i = 0; i < keys.length; i++) {
                    const k = keys[i];
                    if (k.equals(originalUserPubkey)) {
                        keys[i] = publicKey;
                        continue;
                    }
                    for (let j = 0; j < oldDerived.length; j++) {
                        if (k.equals(oldDerived[j])) {
                            keys[i] = newDerived[j];
                            break;
                        }
                    }
                }
            }

            const onStatus = (status: number) => {
                switch (status) {
                    case PROCESS_TRANSACTION_RETRIEVING:
                        updateButtonState(
                            TransactionStatus.RECEIVING,
                            null,
                            button_id,
                        );
                        break;
                    case PROCESS_TRANSACTION_SIGNING:
                        updateButtonState(
                            TransactionStatus.SIGNING,
                            null,
                            button_id,
                        );
                        break;
                    case PROCESS_TRANSACTION_SENDING:
                        updateButtonState(
                            TransactionStatus.SENDING,
                            null,
                            button_id,
                        );
                        break;
                    case PROCESS_TRANSACTION_CONFIRMING:
                        updateButtonState(
                            TransactionStatus.CONFIRMING,
                            null,
                            button_id,
                        );
                        break;
                    default:
                }
            };

            // Sign, send, and confirm transaction
            const signature = await processTransaction(
                tx,
                publicKey,
                signTransaction,
                onStatus,
            );

            // Success
            handleFinish(true, signature, publicKey);
        } catch (err) {
            console.error("Transaction failed:", err);
            console.error("TX data:", JSON.stringify(txData, null, 4));
            currentError =
                err instanceof Error ? err.message : "Transaction failed";
            handleFinish(false);
        }
    };

    const handleFinish = (
        success: boolean,
        signature?: string,
        publicKey?: PublicKey,
    ): void => {
        if (success && txData.onSuccess) {
            // Success override URL provided
            window.location.href = txData.onSuccess;
            return;
        }

        if (!txData.returnUrl) {
            throw new Error("No return URL provided");
        }

        // Create URL object, handling both absolute and relative URLs
        let url;
        if (
            txData.returnUrl.startsWith("http://") ||
            txData.returnUrl.startsWith("https://")
        ) {
            // It's an absolute URL
            url = new URL(txData.returnUrl);
        } else {
            // It's a relative URL
            url = new URL(txData.returnUrl, window.location.origin);
        }

        // Helper to add URL parameters
        const addUrlParam = (
            name: string,
            value: string | undefined | null,
        ) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(name, value);
            }
        };

        // Add parameters based on success or failure
        if (success) {
            addUrlParam("status", "success");
            addUrlParam("signature", signature);
            addUrlParam("wallet", publicKey?.toBase58());
        } else {
            addUrlParam("status", "error");
            addUrlParam("error", currentError || "Unknown error");
        }

        // Append any additional returnParams specified in the dataset
        for (const [key, value] of Object.entries(txData.returnParams)) {
            addUrlParam(key, String(value)); // Convert value to string
        }

        // Redirect to the constructed URL
        window.location.href = url.toString();
    };

    return null;
}
