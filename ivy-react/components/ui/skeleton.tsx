import { cn } from "@/lib/utils";

function Skeleton({
    className,
    ...props
}: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-lg bg-muted",
                "before:absolute before:inset-0",
                "before:translate-x-[-100%]",
                "before:animate-[shimmer_2s_infinite]",
                "before:bg-gradient-to-r",
                "before:from-transparent before:via-white/10 before:to-transparent",
                className,
            )}
            {...props}
        />
    );
}

export { Skeleton };
