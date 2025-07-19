import { useState, useCallback } from "react";
import { Maximize2Icon } from "lucide-react";

type FrameProps = {
    src: string;
    title: string;
    className: string;
    showFullscreenButton: boolean;
    minHeight: number;
    setFrameWindow: (w: Window) => void;
};

export function Frame({
    src,
    title,
    className,
    showFullscreenButton,
    minHeight,
    setFrameWindow,
}: FrameProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [frame, setFrame] = useState<HTMLIFrameElement | null>(null);
    const frameRef = useCallback(
        (node: HTMLIFrameElement) => {
            if (node !== null) {
                setFrame(node);
                if (setFrameWindow && node.contentWindow) {
                    setFrameWindow(node.contentWindow);
                }
            }
        },
        [setFrameWindow],
    );

    const handleFullScreen = useCallback(() => {
        if (!frame) return;

        if (frame.requestFullscreen) {
            frame.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        }
    }, [frame]);

    const onLoad = useCallback(() => {
        if (!isLoading) {
            return;
        }
        setIsLoading(false);
    }, [isLoading]);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                    <span className="text-xl font-bold text-zinc-400">
                        loading
                    </span>
                </div>
            )}

            <iframe
                ref={frameRef}
                src={src}
                className="w-full h-full border-0"
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                onLoad={onLoad}
                style={{
                    visibility: isLoading ? "hidden" : "visible",
                    minHeight: `${minHeight}px`,
                }}
            />

            {showFullscreenButton && (
                <button
                    onClick={handleFullScreen}
                    className="absolute top-2 right-2 z-20 p-1.5 bg-zinc-800/70 hover:bg-zinc-700/90 text-zinc-300 hover:text-white"
                    title="Enter Fullscreen"
                >
                    <Maximize2Icon className="w-4 h-4" />
                </button>
            )}
        </div>
    );
}
