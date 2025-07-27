"use client";

import Head from "next/head";
import Link from "next/link";
import { Search, User } from "lucide-react";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { GameObject } from "@/lib/game";
import { GameDisplay } from "@/components/game-display/GameDisplay";

export default function Home() {
    const exampleGame: unknown = {
        name: "Ivy Dice",
        symbol: "DICE",
        address: "7JizP3Ko7kauyAfrLMPfjg1BKzjKJUm6ShDQCv1VLCug",
        mint: "HEBSUx3YWDMnHPSTRsu2NvmPmQAcUSkf3scVPj8XtuHi",
        swap_alt: "DQ8eb4ByGeKCo43mULS1CUBAawUxisNNucbjmcLcbtHR",
        owner: "2sQ4hGJrxomxXuRzCNSSvHgBwt5CNiKXSfUw19AMVjgA",
        withdraw_authority: "H1JppQY4ohQPdvHv6CMwWYYPg7eUDrSRygCpopqsay35",
        game_url: "https://dice.ivypowered.com",
        cover_url:
            "https://cdn.ivypowered.com/ipfs/bafkreifei2isc2i74hny72q23tfuw6oddk6tdqmwlt25soyw6hc2hgvyri",
        metadata_url:
            "https://cdn.ivypowered.com/ipfs/bafkreiekir26andf6wwdk7k5dofm56zdooxhp4vnqfu63h3ffqmpuy5y3y",
        create_timestamp: 1752906866,
        ivy_balance: "182955597811",
        game_balance: "999842756694278800",
        starting_ivy_balance: "182926829268",
        comment_buf_index: 0,
        last_price_usd: 0.0000012009973,
        mkt_cap_usd: 1200.8085,
        change_pct_24h: 0.04403645,
    };

    return (
        <div className="min-h-screen bg-zinc-900 text-white font-mono">
            <Head>
                <title>ivy</title>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <link
                    rel="icon"
                    href="/assets/ivy-icon.svg"
                    type="image/svg+xml"
                />
            </Head>

            {/* Header */}
            <header className="border-b-4 border-emerald-400 px-6 py-4">
                <div className="mx-auto flex max-w-7xl items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-2xl font-bold"
                    >
                        <img
                            src="/assets/ivy-symbol.svg"
                            alt="Ivy Symbol"
                            className="h-8 text-emerald-400"
                        />
                        <span className="bg-emerald-400 text-emerald-950 px-2">
                            ivy
                        </span>
                    </Link>

                    <nav className="hidden md:block">
                        <ul className="flex items-center gap-8 font-bold text-sm">
                            <li>
                                <a
                                    href="#"
                                    className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                >
                                    explore
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                >
                                    portfolio
                                </a>
                            </li>
                            <li>
                                <a
                                    href="#"
                                    className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                >
                                    community
                                </a>
                            </li>
                        </ul>
                    </nav>

                    <div className="flex items-center gap-4">
                        <div className="relative hidden md:block">
                            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-950" />
                            <input
                                type="search"
                                placeholder="search games..."
                                className="h-9 w-64 rounded-none border-2 border-emerald-400 bg-emerald-50 pl-8 text-sm font-bold text-emerald-950 placeholder:text-emerald-900/70 focus:outline-none focus:ring-0"
                            />
                        </div>
                        <button className="rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 p-2">
                            <User className="h-5 w-5" />
                        </button>
                        <Link
                            href="/upload"
                            className="rounded-none bg-emerald-400 text-emerald-950 hover:bg-emerald-300 font-bold px-4 py-2"
                        >
                            upload game
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content - Game */}
            <WalletProvider autoConnect={true}>
                <></>
                {
                    <GameDisplay
                        game={exampleGame as GameObject}
                        showComments={true}
                    />
                }
            </WalletProvider>

            {/* Footer */}
            <footer className="border-t-4 border-emerald-400 bg-emerald-950 px-6 py-8">
                <div className="mx-auto max-w-7xl">
                    <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                        <div className="flex items-center gap-2">
                            <img
                                src="/assets/ivy-symbol.svg"
                                alt="Ivy Symbol"
                                className="h-7 text-emerald-400"
                            />
                            <span className="text-lg font-bold bg-emerald-400 text-emerald-950 px-1">
                                ivy
                            </span>
                        </div>
                        <nav className="my-4 md:my-0">
                            <ul className="flex flex-wrap items-center gap-6 text-sm font-bold">
                                <li>
                                    <a
                                        href="#"
                                        className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                    >
                                        about
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="#"
                                        className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                    >
                                        docs
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="#"
                                        className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                    >
                                        terms
                                    </a>
                                </li>
                                <li>
                                    <a
                                        href="#"
                                        className="hover:underline decoration-2 decoration-emerald-400 underline-offset-4"
                                    >
                                        privacy
                                    </a>
                                </li>
                            </ul>
                        </nav>
                        <p className="text-sm font-bold">
                            © 2025 ivy. all rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
