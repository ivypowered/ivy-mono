import { Game } from "@/import/ivy-sdk";
import { Api } from "@/lib/api";
import { cn, processTransaction, sfcap } from "@/lib/utils";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
    AlertTriangle,
    ArrowDownToLine,
    ArrowUpFromLine,
    CheckCircle,
    Wallet,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "../ui/skeleton";
import { GameObject } from "@/lib/game";
import { DecimalInput } from "../swap/DecimalInput";
import { Button } from "../ui/button";

export interface TreasuryManagerProps {
    game: GameObject;
    userAddress: string;
    signTransaction: (
        tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>;
    reloadBalancesRef: {
        current: (() => void) | null;
    };
    updateBalance: (mint: string, amount: number) => void;
}

type ActionType = "deposit" | "withdraw";

export function TreasuryManager({
    game,
    userAddress,
    signTransaction,
    reloadBalancesRef,
    updateBalance,
}: TreasuryManagerProps) {
    const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
    const [userBalance, setUserBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<ActionType>("withdraw");

    const fetchBalances = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch both treasury and user balances
            const gameMint = Game.deriveAddresses(
                new PublicKey(game.address),
            ).mint;
            const [treasuryBalanceStr, userBalanceStr] = await Promise.all([
                Api.getTreasuryBalance(new PublicKey(game.address)),
                Api.getTokenBalance(new PublicKey(userAddress), gameMint),
            ]);

            setTreasuryBalance(
                Number.parseInt(treasuryBalanceStr) / 1_000_000_000,
            );
            const userBalance = Number.parseInt(userBalanceStr) / 1_000_000_000;
            setUserBalance(userBalance);
            updateBalance(gameMint.toBase58(), userBalance);
        } catch (err) {
            console.error("Failed to fetch balances:", err);
            setError("Could not load balances");
        } finally {
            setIsLoading(false);
        }
    }, [game, updateBalance, userAddress]);

    useEffect(() => {
        reloadBalancesRef.current = fetchBalances;
    }, [reloadBalancesRef, fetchBalances]);

    useEffect(() => {
        // Fetch balances when component mounts
        fetchBalances();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game.address, userAddress]);

    const handleMaxClick = () => {
        if (activeAction === "withdraw" && treasuryBalance !== null) {
            setAmount(treasuryBalance);
        } else if (activeAction === "deposit" && userBalance !== null) {
            setAmount(userBalance);
        }
    };

    const handleAction = async () => {
        setIsProcessing(true);
        setError(null);
        setSuccess(null);

        try {
            if (isNaN(amount) || amount <= 0) {
                throw new Error("Please enter a valid amount");
            }

            let txPromise: Promise<Transaction>;
            let insName: string;
            if (activeAction === "withdraw") {
                if (treasuryBalance !== null && amount > treasuryBalance) {
                    throw new Error("Amount exceeds treasury balance");
                }

                // withdraw
                insName = "GameDebit";
                txPromise = Game.debit(
                    new PublicKey(game.address),
                    String(Math.floor(amount * 1_000_000_000)),
                    new PublicKey(userAddress),
                );
            } else {
                if (userBalance !== null && amount > userBalance) {
                    throw new Error("Amount exceeds your balance");
                }

                // deposit
                insName = "GameCredit";
                txPromise = Game.credit(
                    new PublicKey(game.address),
                    String(Math.floor(amount * 1_000_000_000)),
                    new PublicKey(userAddress),
                );
            }

            await processTransaction(
                insName,
                txPromise,
                new PublicKey(userAddress),
                signTransaction,
                () => {},
            );

            const verb = activeAction === "withdraw" ? "Withdrew" : "Deposited";

            setSuccess(`${verb} $[amount} ${game.symbol}`);

            // Refresh balances after transaction
            await fetchBalances();
            setAmount(0);
        } catch (err) {
            console.error("Transaction failed:", err);
            setError(err instanceof Error ? err.message : "Transaction failed");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 bg-zinc-900 rounded-none shadow-lg border-4 border-emerald-400">
            <div className="text-sm text-emerald-400 mb-4 font-bold">
                Treasury Management
            </div>

            {/* Action Tabs */}
            <div className="flex mb-4 border-2 border-emerald-400">
                <button
                    className={cn(
                        "flex-1 py-2 font-bold text-center",
                        activeAction === "withdraw"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-transparent text-emerald-400 hover:bg-emerald-400/10",
                    )}
                    onClick={() => {
                        setActiveAction("withdraw");
                        setAmount(0);
                        setError(null);
                        setSuccess(null);
                    }}
                >
                    <ArrowUpFromLine className="h-4 w-4 inline-block mr-2" />
                    Withdraw
                </button>
                <button
                    className={cn(
                        "flex-1 py-2 font-bold text-center",
                        activeAction === "deposit"
                            ? "bg-emerald-400 text-emerald-950"
                            : "bg-transparent text-emerald-400 hover:bg-emerald-400/10",
                    )}
                    onClick={() => {
                        setActiveAction("deposit");
                        setAmount(0);
                        setError(null);
                        setSuccess(null);
                    }}
                >
                    <ArrowDownToLine className="h-4 w-4 inline-block mr-2" />
                    Deposit
                </button>
            </div>

            {/* Balances */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center text-sm text-zinc-400">
                    <Wallet className="h-4 w-4 mr-2 text-emerald-400" />
                    {isLoading ? (
                        <Skeleton className="h-4 w-20 rounded-none border border-zinc-700" />
                    ) : (
                        <span className="text-white">
                            {activeAction === "withdraw"
                                ? `Treasury: ${treasuryBalance !== null ? sfcap(treasuryBalance, 6) : "N/A"}`
                                : `Your balance: ${userBalance !== null ? sfcap(userBalance, 6) : "N/A"}`}{" "}
                            {game.symbol}
                        </span>
                    )}
                </div>
            </div>

            {/* Amount Input */}
            <div className="flex mb-4 relative">
                {amount === undefined ? (
                    <Skeleton className="h-10 w-full rounded-none border-2 border-zinc-700" />
                ) : (
                    <DecimalInput
                        className="w-full bg-zinc-800 border-2 border-emerald-400 text-white p-2 focus-visible:ring-0 focus-visible:outline-none"
                        value={amount}
                        onValueChange={setAmount}
                        disabled={isProcessing}
                    />
                )}
                <Button
                    variant="outline"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 px-2 text-xs rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 font-bold transition-none"
                    onClick={handleMaxClick}
                    disabled={
                        isProcessing ||
                        (activeAction === "withdraw"
                            ? treasuryBalance === null
                            : userBalance === null)
                    }
                >
                    Max
                </Button>
            </div>

            {/* Action Button */}
            <Button
                className="w-full h-12 rounded-none border-2 text-base font-bold transition-none border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                onClick={handleAction}
                disabled={
                    isProcessing ||
                    amount <= 0 ||
                    (activeAction === "withdraw"
                        ? !treasuryBalance
                        : !userBalance)
                }
            >
                {isProcessing
                    ? "loading..."
                    : activeAction === "withdraw"
                      ? "withdraw"
                      : "deposit"}
            </Button>

            {/* Status Messages */}
            {error && (
                <div className="mt-4 p-3 border-2 border-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span className="text-white">{error}</span>
                </div>
            )}

            {success && (
                <div className="mt-4 p-3 border-2 border-emerald-400 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span className="text-white">{success}</span>
                </div>
            )}
        </div>
    );
}
