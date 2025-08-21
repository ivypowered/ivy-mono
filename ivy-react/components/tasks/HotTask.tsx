import { useEffect, useRef } from "react";

function randDelay(minMs: number, maxMs: number) {
    return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

export function HotTask({
    gamesGridElement,
}: {
    gamesGridElement: HTMLElement;
}) {
    const activeRef = useRef(true);

    useEffect(() => {
        activeRef.current = true;

        const bubbleOnce = () => {
            const grid = gamesGridElement;
            if (!grid) return;

            const children = Array.from(grid.children) as HTMLElement[];
            const cards = children.filter((el) => el.querySelector("a"));
            if (cards.length <= 1) return;

            // pick a random card excluding first position
            const randomIndex =
                Math.floor(Math.random() * (cards.length - 1)) + 1;
            const chosen = cards[randomIndex];
            const clone = chosen.cloneNode(true) as HTMLElement;

            // Add bubble animation to inner shell
            const innerShell = clone.querySelector(
                ".border-2",
            ) as HTMLElement | null;
            if (innerShell) {
                innerShell.classList.add("game-card-bubble");
                innerShell.addEventListener(
                    "animationend",
                    () => innerShell.classList.remove("game-card-bubble"),
                    { once: true },
                );
            }

            chosen.remove();
            grid.insertBefore(clone, grid.firstChild);
        };

        const schedule = () => {
            if (!activeRef.current) return;
            const delay = randDelay(3000, 8000); // 3-8s
            setTimeout(() => {
                if (!activeRef.current) return;
                bubbleOnce();
                schedule();
            }, delay);
        };

        schedule();

        return () => {
            activeRef.current = false;
        };
    }, [gamesGridElement]);

    return null;
}
