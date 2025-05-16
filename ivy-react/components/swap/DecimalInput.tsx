import { ChangeEvent, useCallback, useState, useEffect } from "react";

interface DecimalInputProps {
    className?: string;
    value: number;
    onValueChange: (value: number) => void;
    disabled?: boolean;
    unselectable?: boolean;
}

const decimalRegexp = /^\d*(?:[.])?\d*$/;

export function DecimalInput({
    className,
    value,
    onValueChange,
    disabled,
    unselectable,
}: DecimalInputProps) {
    // Store the displayed string value separately from the numeric value
    const [displayValue, setDisplayValue] = useState(
        () => value?.toString() || ""
    );

    // Handle external value changes
    useEffect(() => {
        if (value !== parseFloat(displayValue || "0")) {
            setDisplayValue(value.toString());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const newValue = event.target.value;

            if (newValue === "") {
                setDisplayValue("");
                onValueChange(0);
                return;
            }

            if (newValue === ".") {
                setDisplayValue("0.");
                onValueChange(0);
                return;
            }

            if (!decimalRegexp.test(newValue)) {
                return;
            }

            setDisplayValue(newValue);

            const numberValue = parseFloat(newValue);
            // user-generated input
            if (!isNaN(numberValue) && numberValue !== value) {
                onValueChange(numberValue);
            }
            return;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [onValueChange]
    );

    return (
        <input
            className={className}
            inputMode="decimal"
            pattern="^[0-9]*[.,]?[0-9]*$"
            placeholder="0"
            value={displayValue}
            onChange={handleChange}
            disabled={!!disabled}
            unselectable={unselectable ? "on" : "off"}
        />
    );
}
