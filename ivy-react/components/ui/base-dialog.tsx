"use client";

import React, { useEffect } from "react";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./alert-dialog";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

interface BaseDialogProps {
    open: boolean;
    onClose?: () => void;
    children: React.ReactNode;
    className?: string;
}

export function BaseDialog({
    open,
    onClose,
    className,
    children,
}: BaseDialogProps) {
    const isMobile = useMediaQuery("(max-width: 768px)");
    const [mounted, setMounted] = React.useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return null;
    }

    if (isMobile) {
        return (
            <div
                className={`fixed inset-0 bg-zinc-900 z-40 ${
                    open ? "block" : "hidden"
                }`}
            >
                <div className="flex justify-center h-full">
                    <div className="p-0 max-w-[450px] w-full h-full">
                        {children}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <AlertDialog
            open={open}
            onOpenChange={(v) => !v && onClose && onClose()}
        >
            <AlertDialogHeader className="sr-only">
                <AlertDialogTitle>Dialog</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogContent
                className={cn(
                    "w-full max-w-md border-4 border-emerald-400 bg-zinc-900 p-0 rounded-none",
                    className,
                )}
            >
                <AlertDialogDescription className="sr-only">
                    Dialog description
                </AlertDialogDescription>
                {children}
            </AlertDialogContent>
        </AlertDialog>
    );
}
