"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Button } from "../ui/button";
import {
    MessageCircle,
    User,
    Clock,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { processTransaction } from "@/lib/utils";
import { Comment } from "@/import/ivy-sdk";
import { Api, CommentData, CommentInfo } from "@/lib/api";

const MAX_COMMENTS = 5;

// --- Pagination Component ---

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    disabled?: boolean;
}

function Pagination({
    currentPage,
    totalItems,
    itemsPerPage,
    onPageChange,
    disabled = false,
}: PaginationProps) {
    const showPrev = currentPage > 0;
    // Don't show next if there aren't any comments on the next page
    const showNext = totalItems > (currentPage + 1) * itemsPerPage;

    if (!showPrev && !showNext) {
        return null;
    }

    const prevPage = currentPage - 1;
    const nextPage = currentPage + 1;

    const buttonClass =
        "rounded-none border-2 border-emerald-400 text-emerald-400 hover:bg-emerald-400 hover:text-emerald-950 w-10 h-10 flex items-center justify-center transition-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-emerald-400";

    return (
        <div className="mt-8 flex justify-center items-center gap-2">
            {showPrev && (
                <>
                    <button
                        onClick={() => onPageChange(prevPage)}
                        className={buttonClass}
                        aria-label="Previous Page"
                        disabled={disabled}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPageChange(prevPage)}
                        className={buttonClass}
                        disabled={disabled}
                    >
                        {prevPage + 1}
                    </button>
                </>
            )}

            <span className="rounded-none bg-emerald-400 text-emerald-950 w-10 h-10 flex items-center justify-center font-bold">
                {currentPage + 1}
            </span>

            {showNext && (
                <>
                    <button
                        onClick={() => onPageChange(nextPage)}
                        className={buttonClass}
                        disabled={disabled}
                    >
                        {nextPage + 1}
                    </button>
                    <button
                        onClick={() => onPageChange(nextPage)}
                        className={buttonClass}
                        aria-label="Next Page"
                        disabled={disabled}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </>
            )}
        </div>
    );
}

// --- Helper Functions and Sub-components --- (keeping existing code)

/**
 * Parses comment text to find and separate ">>" references.
 */
function parseCommentText(text: string) {
    const parts: Array<{
        type: "text" | "reference";
        content: string;
        index?: number;
    }> = [];
    const referenceRegex = />>(\d+)/g;
    let lastIndex = 0;
    let match;
    while ((match = referenceRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "text",
                content: text.slice(lastIndex, match.index),
            });
        }
        parts.push({
            type: "reference",
            content: match[0],
            index: parseInt(match[1]),
        });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: "text", content: text.slice(lastIndex) });
    }
    return parts;
}

/**
 * Renders the parsed comment text with clickable references.
 */
function ParsedCommentText({
    text,
    isValidIndex,
    onReferenceClick,
    onReferenceHover,
}: {
    text: string;
    isValidIndex: (i: number) => boolean;
    onReferenceClick: (i: number) => void;
    onReferenceHover: (i: number) => void;
}) {
    const parsedText = useMemo(() => parseCommentText(text), [text]);

    return (
        <span>
            {parsedText.map((part, i) => {
                if (
                    part.type === "reference" &&
                    part.index !== undefined &&
                    isValidIndex(part.index)
                ) {
                    return (
                        <span
                            key={i}
                            className="text-emerald-400 underline cursor-pointer hover:text-emerald-300 transition-none"
                            onClick={() => onReferenceClick(part.index!)}
                            onMouseEnter={() => onReferenceHover(part.index!)}
                            onMouseLeave={() => onReferenceHover(-1)}
                        >
                            {part.content}
                        </span>
                    );
                }
                return <span key={i}>{part.content}</span>;
            })}
        </span>
    );
}

/**
 * Displays a single comment item.
 */
function CommentItem({
    comment,
    isHovered,
    onReply,
    onReferenceClick,
    onReferenceHover,
    isValidIndex,
    commentRef,
}: {
    comment: CommentData;
    isHovered: boolean;
    onReply: (index: number) => void;
    onReferenceClick: (index: number) => void;
    onReferenceHover: (index: number) => void;
    isValidIndex: (index: number) => boolean;
    commentRef: (el: HTMLDivElement | null) => void;
}) {
    const formatTimestamp = (timestamp: string) => {
        try {
            const now = new Date();
            const date = new Date(parseInt(timestamp) * 1000);
            if (
                date.getFullYear() == now.getFullYear() &&
                date.getMonth() == now.getMonth() &&
                date.getDate() == now.getDate()
            ) {
                return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
            }
            return `${date.getFullYear()}-${date.getMonth().toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
        } catch (e) {
            (() => e)();
            return timestamp;
        }
    };

    const [copied, setCopied] = useState<boolean>(false);
    useEffect(() => {
        if (!copied) {
            return;
        }
        const t = setTimeout(() => setCopied(false), 750);
        return () => clearTimeout(t);
    }, [copied]);

    return (
        <div
            ref={commentRef}
            className={`border-2 border-zinc-700 p-3 duration-200 transition-none ${isHovered ? "bg-emerald-400/5 border-emerald-400/50" : ""}`}
        >
            <div className="flex items-center gap-3 mb-2 text-sm text-zinc-400">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span
                        title={
                            copied ? undefined : `Click to copy ${comment.user}`
                        }
                        className={
                            copied ? "" : "hover:text-zinc-300 cursor-pointer"
                        }
                        onClick={
                            copied
                                ? undefined
                                : () => {
                                      setCopied(true);
                                      navigator.clipboard.writeText(
                                          comment.user,
                                      );
                                  }
                        }
                    >
                        {copied ? "copied!" : comment.user.slice(0, 6)}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{formatTimestamp(comment.timestamp)}</span>
                </div>
                <div
                    className="cursor-pointer hover:text-zinc-300 transition-none select-none"
                    title="Click to reply to this comment"
                    onClick={() => onReply(comment.index)}
                >
                    #{comment.index}
                </div>
            </div>
            <div className="text-white whitespace-pre-wrap break-words">
                <ParsedCommentText
                    text={comment.text}
                    isValidIndex={isValidIndex}
                    onReferenceClick={onReferenceClick}
                    onReferenceHover={onReferenceHover}
                />
            </div>
        </div>
    );
}

// --- Main Component ---

interface CommentsProps {
    gameAddress: string;
    userAddress?: string;
    onConnectWallet?: () => void;
    signTransaction: (
        tx: Transaction | VersionedTransaction,
    ) => Promise<Transaction | VersionedTransaction>;
    className?: string;
    initialCommentBufIndex: number;
}

export function Comments({
    gameAddress,
    userAddress,
    onConnectWallet,
    signTransaction,
    initialCommentBufIndex,
}: CommentsProps) {
    const commentBoxRef = useRef<HTMLTextAreaElement | null>(null);
    const [commentText, setCommentText] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);

    // State for the comments list
    const [comments, setComments] = useState<CommentData[]>([]);
    const [totalComments, setTotalComments] = useState(0);
    const [commentBufIndex, setCommentBufIndex] = useState(
        initialCommentBufIndex,
    );
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // State for interactivity
    const [replyTo, setReplyTo] = useState<number>(-1);
    const [hoveredCommentIndex, setHoveredCommentIndex] = useState<
        number | null
    >(null);

    // Refs for scrolling behavior
    const commentsContainerRef = useRef<HTMLDivElement>(null);
    const commentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const [page, setPage] = useState<number>(0);

    // Derived state for visual feedback during page loads
    const isPageLoading = loading && comments.length > 0 && !fetchError;

    const refreshComments = useCallback(
        async (withPage: number) => {
            setLoading(true);
            setFetchError(null);
            try {
                const info = await Api.getComments(
                    new PublicKey(gameAddress),
                    MAX_COMMENTS,
                    withPage * MAX_COMMENTS,
                    true,
                );
                commentRefs.current.clear();
                setComments(info.comments);
                setTotalComments(info.total);
                setCommentBufIndex(info.comment_buf_index);
            } catch (err) {
                setFetchError(
                    err instanceof Error
                        ? err.message
                        : "Failed to load comments",
                );
            } finally {
                setLoading(false);
            }
        },
        [gameAddress],
    );

    useEffect(() => {
        refreshComments(page);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePageChange = async (newPage: number) => {
        // Refresh comments
        await refreshComments(newPage);
        // Teleport user to top of comment section
        commentsContainerRef.current?.scrollIntoView({
            behavior: "instant",
            block: "start",
        });
        // Set page
        setPage(newPage);
    };

    // Effect to handle "reply to" functionality by updating the input text
    useEffect(() => {
        if (replyTo >= 0 && !posting) {
            if (!commentText.includes(`>>${replyTo}`)) {
                setCommentText((c) => `${c}>>${replyTo} `.trimStart());
                commentBoxRef.current?.focus();
            }
            setReplyTo(-1); // Reset after use
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [replyTo, commentText]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!userAddress) {
            onConnectWallet?.();
            return;
        }

        const text = commentText.trim();
        if (!text || text.length > Comment.MAX_LEN) {
            setPostError(
                !text
                    ? "Comment cannot be empty"
                    : `Comment must be ${Comment.MAX_LEN} characters or less`,
            );
            return;
        }

        setPosting(true);
        setPostError(null);
        try {
            const gamePublicKey = new PublicKey(gameAddress);
            const userPublicKey = new PublicKey(userAddress);

            await processTransaction(
                "CommentPost",
                Comment.post(
                    userPublicKey,
                    gamePublicKey,
                    text,
                    commentBufIndex,
                ),
                userPublicKey,
                signTransaction,
                () => {},
            );

            // Manually handle the refresh to perform patching logic for backend latency
            setFetchError(null);

            let info: CommentInfo;
            try {
                // Requirement 2b: Load new comments with page = 0
                info = await Api.getComments(
                    new PublicKey(gameAddress),
                    MAX_COMMENTS,
                    0, // Always fetch page 0
                    true,
                );

                // Patching logic to optimistically display the new comment if backend hasn't caught up
                let found = false;
                if (info.comments.length !== comments.length) {
                    for (const c of info.comments) {
                        if (c.text === text && c.user === userAddress) {
                            found = true;
                            break;
                        }
                    }
                }
                if (!found) {
                    let tempIndex = 0;
                    if (info.comments.length > 0) {
                        tempIndex = info.comments[0].index + 1;
                    }
                    info.comments.unshift({
                        text: text,
                        timestamp: Math.floor(
                            new Date().getTime() / 1000,
                        ).toString(),
                        user: userAddress,
                        index: tempIndex,
                    });
                    info.total++;
                }

                // Update state with new comments
                commentRefs.current.clear();
                setComments(info.comments);
                setTotalComments(info.total);
                setCommentBufIndex(info.comment_buf_index);
                setCommentText("");

                // Set page to 0
                setPage(0);
            } catch (err) {
                setFetchError(String(err));
            } finally {
                setLoading(false);
            }
        } catch (err) {
            console.error("Failed to post comment:", err);
            setPostError(
                err instanceof Error ? err.message : "Failed to post comment",
            );
        } finally {
            setPosting(false);
        }
    };

    const handleReferenceClick = useCallback((index: number) => {
        const element = commentRefs.current.get(index);
        element?.scrollIntoView({ behavior: "instant", block: "center" });
        // Briefly highlight the referenced comment
        element?.classList.add("referenced-highlight");
        setTimeout(
            () => element?.classList.remove("referenced-highlight"),
            1000,
        );
    }, []);

    const isValidIndex = useCallback(
        (index: number) => {
            // prettier-ignore
            const max = (
                (totalComments - 1) // 1st comment in reversed list
                - (page * MAX_COMMENTS) // how many pages?
            );
            const min = Math.max(0, max - MAX_COMMENTS + 1);
            return index >= min && index <= max;
        },
        [totalComments, page],
    );

    if (loading && comments.length === 0) {
        return (
            <div className="bg-zinc-900 border-4 border-emerald-400">
                <div className="p-4 h-32 flex items-center justify-center text-zinc-500 text-md">
                    loading comments...
                </div>
            </div>
        );
    }

    if (fetchError && comments.length === 0) {
        return (
            <div className="bg-zinc-900 border-4 border-emerald-400">
                <div className="p-4 h-32 flex flex-col items-center justify-center space-y-2 text-md text-zinc-400">
                    <div className="flex">
                        Failed to load comments: {fetchError || "unknown error"}
                    </div>
                    <Button
                        className="mt-4 text-white rounded-none border-emerald-400 bg-transparent border-2 transition-none hover:bg-zinc-800 font-bold"
                        onClick={() => refreshComments(page)}
                    >
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={commentsContainerRef}
            className="bg-zinc-900 border-4 border-emerald-400"
        >
            <style>
                {`.referenced-highlight {
                    background-color: rgba(16, 185, 129, 0.2) !important;
                    border-color: rgba(110, 231, 183, 0.7) !important;
                 }`}
            </style>
            <div className="p-4 border-b-2 border-emerald-400 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-emerald-400 font-bold">Comments</span>
                <span className="text-zinc-500 text-sm">({totalComments})</span>
            </div>

            {/* Comment Input Box */}
            <div className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={commentText}
                            maxLength={Comment.MAX_LEN}
                            onChange={(e) => {
                                setCommentText(e.target.value);
                                if (postError) setPostError(null);
                            }}
                            placeholder="Type a comment..."
                            disabled={posting}
                            className={
                                "w-full h-24 p-3 bg-zinc-800 border-2 text-white placeholder-zinc-500 resize-none focus:outline-none border-zinc-600 focus:border-emerald-400 disabled:opacity-70"
                            }
                            ref={commentBoxRef}
                        />
                        <div className="absolute right-4 bottom-4 text-zinc-500 text-sm">
                            {commentText.length}/{Comment.MAX_LEN}
                        </div>
                    </div>

                    {postError && (
                        <span className="text-red-400 text-sm">
                            {postError}
                        </span>
                    )}

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={posting || loading || !commentText.trim()}
                            className="rounded-none transition-none bg-emerald-400 text-emerald-950 hover:bg-emerald-500 font-bold disabled:opacity-70 disabled:bg-emerald-400"
                        >
                            {posting
                                ? "posting..."
                                : !userAddress
                                  ? "connect to post"
                                  : "post comment"}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Error */}
            {fetchError && (
                <div className="pb-4 pr-4 pl-4 text-center py-8">
                    <div className="text-red-400 mb-2">
                        Failed to load comments
                    </div>
                    <div className="text-zinc-500 text-sm">{postError}</div>
                    <Button
                        className="mt-4 text-white rounded-none border-emerald-400 bg-transparent border-2 transition-none hover:bg-zinc-800 font-bold"
                        onClick={() => refreshComments(page)}
                    >
                        Retry
                    </Button>
                </div>
            )}

            {!fetchError && comments.length > 0 && (
                <div
                    className={
                        isPageLoading
                            ? "pb-4 pr-4 pl-4 opacity-50 pointer-events-none"
                            : "pb-4 pr-4 pl-4"
                    }
                >
                    <div className="space-y-4">
                        {comments.map((comment) => (
                            <CommentItem
                                key={comment.index}
                                comment={comment}
                                isHovered={
                                    hoveredCommentIndex === comment.index
                                }
                                onReply={setReplyTo}
                                onReferenceClick={handleReferenceClick}
                                onReferenceHover={setHoveredCommentIndex}
                                isValidIndex={isValidIndex}
                                commentRef={(el) => {
                                    if (el)
                                        commentRefs.current.set(
                                            comment.index,
                                            el,
                                        );
                                    else
                                        commentRefs.current.delete(
                                            comment.index,
                                        );
                                }}
                            />
                        ))}
                    </div>

                    {/* Pagination */}
                    <Pagination
                        currentPage={page}
                        totalItems={totalComments}
                        itemsPerPage={MAX_COMMENTS}
                        onPageChange={handlePageChange}
                        disabled={loading || posting}
                    />
                </div>
            )}
        </div>
    );
}
