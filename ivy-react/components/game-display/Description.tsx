import ReactMarkdown from "react-markdown";

export function Description({
    description,
    className,
}: {
    description?: string;
    className?: string;
}) {
    if (!description) {
        return <></>;
    }
    return (
        <div className={`relative ${className || ""}`}>
            {/* Hollow Description Tab */}
            <div className="absolute -top-3 left-4 bg-zinc-900 px-3 py-1 text-emerald-400 font-bold border-4 border-emerald-400 text-sm">
                Description
            </div>
            {/* Description Content */}
            <div className="border-4 border-emerald-400 p-4 pt-8 bg-zinc-900 markdown">
                <ReactMarkdown>{description}</ReactMarkdown>
            </div>
        </div>
    );
}
