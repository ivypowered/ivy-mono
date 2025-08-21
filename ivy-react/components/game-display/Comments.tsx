"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { Button } from "../ui/button";
import { MessageCircle, User, Clock } from "lucide-react";
import { processTransaction } from "@/lib/utils";
import { Comment } from "@/import/ivy-sdk";
import { CommentData } from "@/lib/api";

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
    comments?: CommentData[]; // Now passed from parent via stream
    totalComments: number;
}

export function Comments({
    gameAddress,
    userAddress,
    onConnectWallet,
    signTransaction,
    comments,
    totalComments,
}: CommentsProps) {
    const commentBoxRef = useRef<HTMLTextAreaElement | null>(null);
    const [commentText, setCommentText] = useState("");
    const [posting, setPosting] = useState(false);
    const [postError, setPostError] = useState<string | null>(null);

    // State for interactivity
    const [replyTo, setReplyTo] = useState<number>(-1);
    const [hoveredCommentIndex, setHoveredCommentIndex] = useState<
        number | null
    >(null);

    // Refs for scrolling behavior
    const commentsContainerRef = useRef<HTMLDivElement>(null);
    const commentRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Update comment refs when comments change
    useEffect(() => {
        commentRefs.current.clear();
    }, [comments]);

    // Effect to handle "reply to" functionality
    useEffect(() => {
        if (replyTo >= 0 && !posting) {
            if (!commentText.includes(`>>${replyTo}`)) {
                setCommentText((c) => `${c}>>${replyTo} `.trimStart());
                commentBoxRef.current?.focus();
            }
            setReplyTo(-1);
        }
    }, [replyTo, commentText, posting]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!comments) {
            setPostError("can't send comment when they're still loading");
            return;
        }

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
                Comment.post(userPublicKey, gamePublicKey, text),
                userPublicKey,
                signTransaction,
                () => {},
            );

            setCommentText("");
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
        element?.classList.add("referenced-highlight");
        setTimeout(
            () => element?.classList.remove("referenced-highlight"),
            1000,
        );
    }, []);

    const isValidIndex = useCallback(
        (index: number) => {
            // All comments are visible now, so check if index exists in our comments
            return !!(comments && comments.some((c) => c.index === index));
        },
        [comments],
    );

    if (!comments) {
        return (
            <div className="bg-zinc-900 border-4 border-emerald-400">
                <div className="p-4 h-32 flex items-center justify-center text-zinc-500 text-md">
                    loading comments...
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
                            className="w-full h-24 p-3 bg-zinc-800 border-2 text-white placeholder-zinc-500 resize-none focus:outline-none border-zinc-600 focus:border-emerald-400 disabled:opacity-70"
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
                            disabled={posting || !commentText.trim()}
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

            {/* Comments List - All visible, no pagination */}
            {comments.length > 0 && (
                <div className="pb-4 pr-4 pl-4">
                    <div className="space-y-4 max-h-[800px] overflow-y-auto">
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
                </div>
            )}
        </div>
    );
}
