"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { BaseDialog } from "../ui/base-dialog";

const PRESET_SLIPPAGES = [
    { label: "0.5%", value: 50 },
    { label: "1%", value: 100 },
    { label: "2%", value: 200 },
    { label: "3%", value: 300 },
];

interface SlippageDialogProps {
    open: boolean;
    onClose: () => void;
    currentSlippageBps: number;
    onSave: (slippageBps: number) => void;
}

export function SlippageDialog({
    open,
    onClose,
    currentSlippageBps,
    onSave,
}: SlippageDialogProps) {
    const [selectedSlippageBps, setSelectedSlippageBps] =
        useState(currentSlippageBps);
    const [customValue, setCustomValue] = useState("");
    const [isCustom, setIsCustom] = useState(false);

    useEffect(() => {
        if (!open) return;

        setSelectedSlippageBps(currentSlippageBps);
        const isPreset = PRESET_SLIPPAGES.some(
            (p) => p.value === currentSlippageBps,
        );
        setCustomValue(isPreset ? "" : (currentSlippageBps / 100).toString());
    }, [currentSlippageBps, open]);

    const handlePresetClick = (bps: number) => {
        setSelectedSlippageBps(bps);
        setCustomValue("");
        setIsCustom(false);
    };

    const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setCustomValue(value);

        const num = parseFloat(value);
        setSelectedSlippageBps(
            isNaN(num) || num <= 0 || num > 100 ? NaN : Math.round(num * 100),
        );
    };

    const handleSave = () => {
        onSave(selectedSlippageBps);
        onClose();
    };

    const isSaveDisabled = isCustom && (!customValue || !selectedSlippageBps);

    return (
        <BaseDialog
            open={open}
            onClose={onClose}
            className="border-emerald-400"
        >
            <div className="bg-zinc-900 text-white font-mono">
                <div className="border-b-4 border-emerald-400 p-4">
                    <h2 className="text-xl font-bold tracking-wider">
                        SLIPPAGE TOLERANCE
                    </h2>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <div className="text-sm font-bold text-emerald-400 mb-3 tracking-wider">
                            PRESET OPTIONS
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {PRESET_SLIPPAGES.map((preset) => (
                                <button
                                    key={preset.value}
                                    onClick={() =>
                                        handlePresetClick(preset.value)
                                    }
                                    className={cn(
                                        "py-2 px-3 border-2 font-bold transition-none",
                                        selectedSlippageBps === preset.value &&
                                            !isCustom
                                            ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                                            : "border-zinc-700 text-white hover:border-emerald-400",
                                    )}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-sm font-bold text-emerald-400 mb-3 tracking-wider">
                            CUSTOM
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                className={cn(
                                    "w-full h-12 px-3 pr-10 border-2 bg-zinc-800 font-bold transition-none outline-none focus:border-emerald-400 border-zinc-700 text-white",
                                )}
                                value={customValue}
                                onChange={handleCustomChange}
                                onFocus={() => setIsCustom(true)}
                                placeholder=""
                                style={{
                                    appearance: "textfield",
                                }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">
                                %
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border-t-4 border-emerald-400 p-4 flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 border-2 border-zinc-700 text-zinc-400 hover:border-zinc-600 font-bold transition-none"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaveDisabled}
                        className={cn(
                            "flex-1 py-2 border-2 font-bold transition-none",
                            isSaveDisabled
                                ? "border-zinc-700 bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : "border-emerald-400 bg-emerald-400 text-emerald-950 hover:bg-emerald-300",
                        )}
                    >
                        SAVE
                    </button>
                </div>
            </div>
        </BaseDialog>
    );
}
