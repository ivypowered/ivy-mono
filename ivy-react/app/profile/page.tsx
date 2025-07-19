"use client";

import { ChevronDown, Trophy, Package, User, LogOut, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function Dashboard() {
    // --- Mock Blockchain User Data ---
    // Simulating data that might come from a wallet connection and contract reads
    const userData = {
        publicKey: "0x1A2b3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b", // Example public key
        avatar: "/placeholder.svg?height=100&width=100", // Keep avatar for visual identity
        joinDate: "Oct 10, 2022", // Could represent first transaction date or profile creation
        games: [
            {
                id: "1",
                title: "CYBER NEXUS",
                description: "A gripping game of cyber warfare.",
                image: "https://placehold.co/600x200/020617/0ea5e9?text=CYBER+NEXUS&font=montserrat",
                coverImage:
                    "https://placehold.co/600x900/020617/0ea5e9?text=CYBER+NEXUS&font=montserrat",
                lastPlayed: "2 hours ago", // Could be last interaction timestamp
                playtime: "42 hours", // Could be tracked off-chain or via specific interactions
                currency: {
                    name: "Credits",
                    amount: 12450,
                    icon: "💾",
                    usdValue: 62.25, // Added USD value for the currency balance
                    tokenSymbol: "CNX", // Added token symbol
                },
                items: [
                    // Items now represent NFTs or SFTs with balances
                    {
                        id: "i1",
                        name: "Plasma Rifle",
                        description:
                            "High-powered weapon that fires concentrated plasma bursts",
                        balance: 1,
                    },
                    {
                        id: "i2",
                        name: "Neural Implant",
                        description:
                            "Augmentation that enhances cognitive abilities and reaction time",
                        balance: 3,
                    },
                    {
                        id: "i3",
                        name: "Stealth Module",
                        description:
                            "Device that bends light to make the user nearly invisible",
                        balance: 1,
                    },
                ],
                achievements: [
                    // Achievements might be on-chain badges/SBTs
                    {
                        id: "a1",
                        name: "First Blood",
                        description: "Defeat your first enemy",
                        unlocked: true,
                    }, // Removed date
                    {
                        id: "a2",
                        name: "Hacker Elite",
                        description: "Breach 50 security systems",
                        unlocked: true,
                    }, // Removed date
                    {
                        id: "a3",
                        name: "Ghost Protocol",
                        description:
                            "Complete a mission without being detected",
                        unlocked: false,
                    },
                ],
            },
            {
                id: "2",
                title: "PIXEL DUNGEON",
                description:
                    "Try to escape the pixelated dungeon, before you become one of them!",
                image: "https://placehold.co/600x200/2a0944/f0abfc?text=PIXEL+DUNGEON&font=montserrat",
                coverImage:
                    "https://placehold.co/600x900/2a0944/f0abfc?text=PIXEL+DUNGEON&font=montserrat",
                lastPlayed: "Yesterday",
                playtime: "28 hours",
                currency: {
                    name: "Gold",
                    amount: 3785,
                    icon: "🪙",
                    usdValue: 37.85, // Added USD value
                    tokenSymbol: "PGLD", // Added token symbol
                },
                items: [
                    {
                        id: "i4",
                        name: "Enchanted Sword",
                        description:
                            "Ancient blade imbued with magical properties that damage enemies",
                        balance: 1,
                    },
                    {
                        id: "i5",
                        name: "Health Potion",
                        description:
                            "Magical concoction that restores health when consumed",
                        balance: 15,
                    },
                ],
                achievements: [
                    {
                        id: "a4",
                        name: "Dungeon Master",
                        description: "Clear all levels",
                        unlocked: false,
                    },
                    {
                        id: "a5",
                        name: "Treasure Hunter",
                        description: "Find 100 gold coins",
                        unlocked: true,
                    }, // Removed date
                ],
            },
            {
                id: "3",
                title: "VOID RAIDERS",
                description:
                    "Harness your inner strength to raid the darkest parts of the cosmos.",
                image: "https://placehold.co/600x200/052e16/4ade80?text=VOID+RAIDERS&font=montserrat",
                coverImage:
                    "https://placehold.co/600x900/052e16/4ade80?text=VOID+RAIDERS&font=montserrat",
                lastPlayed: "3 days ago",
                playtime: "15 hours",
                currency: {
                    name: "Stardust",
                    amount: 8920,
                    icon: "✨",
                    usdValue: 89.2, // Added USD value
                    tokenSymbol: "VRST", // Added token symbol
                },
                items: [
                    {
                        id: "i6",
                        name: "Quantum Shield",
                        description:
                            "Advanced defensive tech that creates an impenetrable energy barrier",
                        balance: 2,
                    },
                    {
                        id: "i7",
                        name: "Gravity Boots",
                        description:
                            "Footwear that allows the user to walk on any surface regardless of gravity",
                        balance: 1,
                    },
                ],
                achievements: [
                    {
                        id: "a6",
                        name: "Space Explorer",
                        description: "Visit 10 different planets",
                        unlocked: true,
                    }, // Removed date
                    {
                        id: "a7",
                        name: "Fleet Commander",
                        description: "Assemble a fleet of 5 ships",
                        unlocked: false,
                    },
                ],
            },
            {
                id: "4",
                title: "ASTRO MINER",
                description: "Mining away... I don't know what to mine!",
                image: "https://placehold.co/600x200/1e1b4b/a5b4fc?text=ASTRO+MINER&font=montserrat",
                coverImage:
                    "https://placehold.co/600x900/1e1b4b/a5b4fc?text=ASTRO+MINER&font=montserrat",
                lastPlayed: "1 week ago",
                playtime: "5 hours",
                currency: {
                    name: "Ore",
                    amount: 530,
                    icon: "⛏️",
                    usdValue: 5.3, // Added USD value
                    tokenSymbol: "AMOR", // Added token symbol
                },
                items: [], // No items for this game
                achievements: [], // No achievements for this game
            },
        ],
    };

    // --- Helper Functions ---

    // Calculate total USD value of all game currencies
    const totalUsdValue = userData.games.reduce(
        (sum, game) => sum + game.currency.usdValue,
        0,
    );

    // Function to truncate public key
    const truncateKey = (key: string, startChars = 6, endChars = 4) => {
        if (!key) return "";
        return `${key.substring(0, startChars)}...${key.substring(key.length - endChars)}`;
    };

    // Function to copy text to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                // Optional: Show a notification or change icon briefly
                console.log("Public key copied to clipboard");
            })
            .catch((err) => {
                console.error("Failed to copy text: ", err);
            });
    };

    // Function to prevent summary toggle unless the chevron area is clicked
    const handleSummaryClick = (event: React.MouseEvent<HTMLElement>) => {
        const toggleButton = (event.target as Element).closest(
            ".toggle-button",
        );
        if (!toggleButton) {
            event.preventDefault();
        }
    };

    return (
        <div className="min-h-screen bg-zinc-900 text-white font-['JetBrains_Mono',monospace]">
            <header className="border-b-4 border-emerald-400 px-6 py-4">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <div className="flex items-center gap-2 text-2xl font-bold">
                        <span className="bg-emerald-400 text-emerald-950 px-2">
                            ivy
                        </span>
                        <span>dashboard</span>
                    </div>

                    {/* User Profile button in header */}
                    <div className="flex items-center gap-4">
                        <button className="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2 h-10 w-10">
                            <User className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="py-8">
                <div className="mx-auto max-w-7xl px-6">
                    {/* User Profile */}
                    <Card className="mb-8 rounded-none border-2 border-emerald-400 bg-zinc-800 p-6">
                        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                            <div className="w-24 h-24 border-2 border-emerald-400 flex-shrink-0">
                                <img
                                    src={userData.avatar || "/placeholder.svg"}
                                    alt="User avatar"
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1">
                                {/* Public Key Display */}
                                <div className="flex items-center gap-2 mb-2 justify-center md:justify-start group">
                                    <h1 className="text-xl md:text-2xl font-bold break-all md:break-normal">
                                        {truncateKey(userData.publicKey)}
                                    </h1>
                                    <button
                                        onClick={() =>
                                            copyToClipboard(userData.publicKey)
                                        }
                                        className="text-zinc-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Copy public key"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Total Value and Join Date */}
                                <div className="flex flex-col md:flex-row gap-4 md:gap-8 text-md text-zinc-400 mb-4 text-center md:text-left">
                                    <p>
                                        Total Value:{" "}
                                        <span className="text-emerald-400 font-semibold">
                                            $
                                            {totalUsdValue.toLocaleString(
                                                "en-US",
                                                {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                },
                                            )}
                                        </span>
                                    </p>
                                </div>
                                {/* Log Out/Disconnect button */}
                                <div className="flex justify-center md:justify-start">
                                    <button className="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-2 flex items-center gap-2">
                                        <LogOut className="h-4 w-4" />
                                        <span>disconnect</span>{" "}
                                        {/* Changed text */}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Games List */}
                    <div className="mb-4">
                        <h2 className="text-xl font-bold mb-4 border-b-2 border-emerald-400 pb-2">
                            your game assets
                        </h2>

                        <div className="space-y-6">
                            {userData.games.map((game) => (
                                <details
                                    key={game.id}
                                    className="group bg-zinc-800 border-2 border-zinc-700 relative transition-colors"
                                >
                                    <summary
                                        className="flex flex-col md:flex-row cursor-default"
                                        onClick={handleSummaryClick}
                                    >
                                        <style>{`
                      details > summary { list-style: none; }
                      details > summary::-webkit-details-marker { display: none; }
                      details > summary { user-select: none; }
                    `}</style>

                                        <div className="w-full md:w-64 flex-shrink-0">
                                            <img
                                                src={game.image}
                                                alt={game.title}
                                                className="w-full h-32 md:h-[150px] object-cover"
                                            />
                                        </div>

                                        <div className="flex flex-col md:flex-row flex-1 p-4">
                                            <div className="flex-1 mb-4 md:mb-0">
                                                <h3 className="font-bold text-xl mb-2">
                                                    <a
                                                        href="#"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                        className="hover:text-emerald-400 cursor-pointer"
                                                    >
                                                        {game.title}
                                                    </a>
                                                </h3>
                                                <div className="flex flex-col sm:flex-row gap-x-4 gap-y-1 text-sm text-zinc-400">
                                                    {game.description}
                                                </div>

                                                {/* Currency (Desktop) */}
                                                <div className="hidden md:block mt-3">
                                                    <div className="inline-flex items-center gap-2 bg-zinc-800 border-2 border-emerald-400 px-3 py-2">
                                                        <span className="text-xl">
                                                            {game.currency.icon}
                                                        </span>
                                                        <span className="font-bold text-emerald-400">
                                                            {game.currency.amount.toLocaleString()}{" "}
                                                            {
                                                                game.currency
                                                                    .tokenSymbol
                                                            }
                                                        </span>
                                                        <span className="text-zinc-400 text-sm">
                                                            (≈ $
                                                            {game.currency.usdValue.toLocaleString(
                                                                "en-US",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                },
                                                            )}
                                                            )
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between md:items-start md:ml-4 flex-shrink-0">
                                                {/* Currency (Mobile) */}
                                                <div className="md:hidden bg-zinc-800 border-2 border-emerald-400 px-3 py-2">
                                                    <div className="flex flex-col items-start gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xl">
                                                                {
                                                                    game
                                                                        .currency
                                                                        .icon
                                                                }
                                                            </span>
                                                            <span className="font-bold text-emerald-400">
                                                                {game.currency.amount.toLocaleString()}{" "}
                                                                {
                                                                    game
                                                                        .currency
                                                                        .tokenSymbol
                                                                }
                                                            </span>
                                                        </div>
                                                        <span className="text-zinc-400 text-xs pl-1">
                                                            (≈ $
                                                            {game.currency.usdValue.toLocaleString(
                                                                "en-US",
                                                                {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                },
                                                            )}
                                                            )
                                                        </span>
                                                    </div>
                                                </div>

                                                {(game.items.length > 0 ||
                                                    game.achievements.length >
                                                        0) && (
                                                    <div className="toggle-button p-2 border-2 border-zinc-700 hover:border-emerald-400 hover:text-emerald-400 group-open:text-emerald-400 cursor-pointer">
                                                        <ChevronDown className="h-5 w-5 group-open:rotate-180" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </summary>

                                    {(game.items.length > 0 ||
                                        game.achievements.length > 0) && (
                                        <div className="border-t-2 border-zinc-700 group-open:border-emerald-400 transition-colors">
                                            {/* Game Items Section */}
                                            {game.items.length > 0 && (
                                                <div className="bg-zinc-800">
                                                    <div className="flex items-center p-3 border-b border-zinc-700 group-open:border-emerald-400 transition-colors">
                                                        <div className="flex items-center gap-2 font-bold">
                                                            <Package className="h-4 w-4 text-emerald-400" />
                                                            <h4>GAME ITEMS</h4>{" "}
                                                            {/* Could be NFTs/SFTs */}
                                                        </div>
                                                    </div>

                                                    <div className="p-4">
                                                        <div className="space-y-4">
                                                            {game.items.map(
                                                                (item) => (
                                                                    <div
                                                                        key={
                                                                            item.id
                                                                        }
                                                                        className="border-b border-zinc-700 group-open:border-emerald-400/50 pb-4 last:border-b-0"
                                                                    >
                                                                        <div className="flex justify-between items-start">
                                                                            <p className="font-semibold">
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </p>
                                                                            <p className="text-sm text-emerald-400 font-semibold">
                                                                                Balance:{" "}
                                                                                {
                                                                                    item.balance
                                                                                }
                                                                            </p>
                                                                        </div>
                                                                        <p className="text-sm text-zinc-400 mt-1">
                                                                            {
                                                                                item.description
                                                                            }
                                                                        </p>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Achievements Section */}
                                            {game.achievements.length > 0 && (
                                                <div
                                                    className={`bg-zinc-800 ${game.items.length > 0 ? "border-t-2 border-zinc-700 group-open:border-emerald-400" : ""} transition-colors`}
                                                >
                                                    <div className="flex items-center p-3 border-b border-zinc-700 group-open:border-emerald-400 transition-colors">
                                                        <div className="flex items-center gap-2 font-bold">
                                                            <Trophy className="h-4 w-4 text-emerald-400" />
                                                            <h4>
                                                                ACHIEVEMENTS
                                                            </h4>{" "}
                                                            {/* Could be Badges/SBTs */}
                                                        </div>
                                                    </div>

                                                    <div className="p-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {game.achievements.map(
                                                                (
                                                                    achievement,
                                                                ) => (
                                                                    <div
                                                                        key={
                                                                            achievement.id
                                                                        }
                                                                        className={`p-3 ${
                                                                            achievement.unlocked
                                                                                ? "bg-emerald-400/10 border-l-4 border-emerald-400"
                                                                                : "bg-zinc-700/50 border-l-4 border-zinc-600 opacity-60"
                                                                        }`}
                                                                    >
                                                                        <div className="flex justify-between items-start gap-2">
                                                                            <h5 className="font-bold">
                                                                                {
                                                                                    achievement.name
                                                                                }
                                                                            </h5>
                                                                            {achievement.unlocked ? (
                                                                                <span className="text-xs bg-emerald-400 text-emerald-950 px-2 py-1 font-semibold flex-shrink-0">
                                                                                    UNLOCKED
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs bg-zinc-600 text-zinc-300 px-2 py-1 font-semibold flex-shrink-0">
                                                                                    LOCKED
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-sm text-zinc-400 mt-1">
                                                                            {
                                                                                achievement.description
                                                                            }
                                                                        </p>
                                                                        {/* Removed unlocked date display */}
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
