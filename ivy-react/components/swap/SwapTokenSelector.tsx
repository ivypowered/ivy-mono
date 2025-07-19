"use client";

import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { List, AutoSizer } from "react-virtualized-compat";
import "react-virtualized-compat/styles.css";
import { useSwap } from "./SwapProvider";

export function SwapTokenSelector() {
    const {
        tokens = [],
        commonTokens,
        closeTokenSelector,
        selectToken,
    } = useSwap();

    const [search, setSearch] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Focus search input on mount
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    const filteredTokens = useMemo(() => {
        if (!tokens.length) return [];

        const searchLower = search.trim().toLowerCase();
        if (!searchLower) return tokens;

        return tokens
            .filter(
                (token) =>
                    token.symbol.toLowerCase().includes(searchLower) ||
                    token.name.toLowerCase().includes(searchLower) ||
                    token.mint?.toLowerCase() === searchLower,
            )
            .sort((a, b) => {
                const aSymbol = a.symbol.toLowerCase();
                const bSymbol = b.symbol.toLowerCase();
                if (aSymbol === searchLower) return -1;
                if (bSymbol === searchLower) return 1;
                if (
                    aSymbol.startsWith(searchLower) &&
                    !bSymbol.startsWith(searchLower)
                )
                    return -1;
                if (
                    !aSymbol.startsWith(searchLower) &&
                    bSymbol.startsWith(searchLower)
                )
                    return 1;
                return aSymbol.localeCompare(bSymbol);
            });
    }, [search, tokens]);

    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            setSearch(e.target.value);
        },
        [],
    );

    const handleClearSearch = useCallback(() => {
        setSearch("");
        searchInputRef.current?.focus();
    }, []);

    const rowRenderer = ({
        key,
        index,
        style,
    }: {
        key: string;
        index: number;
        style: React.CSSProperties;
    }) => {
        const token = filteredTokens[index];
        if (!token) return null;

        return (
            <div key={key} style={style}>
                <button
                    onClick={() => selectToken(token)}
                    className="w-full text-left h-16 px-4 flex items-center gap-4 border-b border-zinc-800 hover:bg-emerald-900/30 hover:text-emerald-50"
                >
                    <div className="flex-shrink-0 w-6 h-6 bg-zinc-800 overflow-hidden rounded-full border border-zinc-600">
                        <img
                            src={token.icon || "/placeholder.svg"}
                            alt=""
                            width={24}
                            height={24}
                            className="w-full h-full object-contain"
                            loading="lazy"
                        />
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-base font-bold truncate max-w-full">
                            {token.symbol}
                        </span>
                        <span className="text-xs text-zinc-400 truncate max-w-full">
                            {token.name}
                        </span>
                    </div>
                </button>
            </div>
        );
    };

    return (
        <div className="flex flex-col bg-zinc-900 text-white w-full h-full">
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-emerald-400 p-4">
                <h2 className="text-xl font-bold tracking-wider">
                    SELECT TOKEN
                </h2>
                <button
                    onClick={closeTokenSelector}
                    className="border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-zinc-900 p-1"
                    aria-label="Close"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b-2 border-emerald-400">
                <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center bg-emerald-400">
                        <Search className="h-5 w-5 text-zinc-900" />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="search name or paste address"
                        className="w-full h-12 border-2 border-emerald-400 bg-zinc-800 pl-14 pr-10 font-bold text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                        value={search}
                        onChange={handleSearchChange}
                        aria-label="Search tokens"
                    />
                    {search && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                            aria-label="Clear search"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Common Tokens */}
            {commonTokens.length > 0 && (
                <div className="border-b-2 border-emerald-400">
                    <h3 className="px-4 pt-2 pb-2 text-sm font-bold mb-3 tracking-wider text-emerald-400 border-b-2 border-emerald-400">
                        COMMON TOKENS
                    </h3>
                    <div className="px-4 pb-4 grid grid-cols-4 gap-3">
                        {commonTokens.map((token) => (
                            <button
                                key={token.mint || token.symbol}
                                onClick={() => selectToken(token)}
                                className="flex flex-col items-center p-2 border-2 border-zinc-700 hover:border-emerald-400 hover:bg-emerald-900/30"
                            >
                                <div className="w-8 h-8 bg-zinc-800 rounded-full overflow-hidden mb-2 border border-zinc-600">
                                    <img
                                        src={token.icon || "/placeholder.svg"}
                                        alt=""
                                        width={32}
                                        height={32}
                                        className="w-full h-full object-contain"
                                        loading="lazy"
                                    />
                                </div>
                                <span className="text-xs font-bold truncate max-w-full">
                                    {token.symbol}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* All Tokens */}
            <div className="flex-1 overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold py-2 px-4 tracking-wider text-emerald-400 border-b-2 border-emerald-400 sticky top-0 z-10 bg-zinc-900">
                    ALL TOKENS
                </h3>
                {filteredTokens.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-center p-4">
                        <p className="text-zinc-400 font-bold">
                            No tokens found
                        </p>
                    </div>
                ) : (
                    <div className="flex-1 min-h-[256px]">
                        {/* Set minimum height to 4 rows (4 * 64px = 256px) */}
                        <AutoSizer>
                            {({ width, height }) => (
                                <List
                                    width={width}
                                    height={height}
                                    rowCount={filteredTokens.length}
                                    rowHeight={64}
                                    rowRenderer={rowRenderer}
                                    overscanRowCount={5}
                                />
                            )}
                        </AutoSizer>
                    </div>
                )}
            </div>
        </div>
    );
}
