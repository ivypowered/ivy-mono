import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
 * @param continue_ Function that determines whether to continue retrying (returns true) or stop silently (returns false)
 * @returns Promise that resolves when f succeeds, or never resolves if continue returns false
 */
export function infinitely<T>(
    f: () => Promise<T>,
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
                .then(resolve)
                .catch((error) => {
                    console.error("operation failed", error);

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
