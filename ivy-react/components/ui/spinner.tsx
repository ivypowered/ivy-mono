import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SpinnerProps = React.HTMLAttributes<HTMLDivElement>;

export function Spinner({ className, ...props }: SpinnerProps) {
    return (
        <div
            className={cn("animate-spin text-muted-foreground", className)}
            {...props}
        >
            <Loader2 className="h-4 w-4" />
            <span className="sr-only">Loading</span>
        </div>
    );
}
