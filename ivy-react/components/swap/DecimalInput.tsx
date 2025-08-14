import { ChangeEvent, useCallback, useState, useEffect } from "react";
import { Decimal } from "decimal.js-light";
import { DECIMAL_ZERO } from "@/lib/constants";

interface DecimalInputProps {
    className?: string;
    value: Decimal;
    onValueChange: (value: Decimal) => void;
    disabled?: boolean;
    unselectable?: boolean;
    displayOverride?: string;
}

const decimalRegexp = /^\d*(?:[.])?\d*$/;

export function DecimalInput({
    className,
    value,
    onValueChange,
    disabled,
    unselectable,
    displayOverride,
}: DecimalInputProps) {
    const [displayValue, setDisplayValue] = useState(
        () =>
            displayOverride ??
            (value.isZero() && !disabled && !unselectable
                ? ""
                : value.toString()),
    );

    useEffect(() => {
        if (displayOverride !== undefined) {
            setDisplayValue(displayOverride);
        }
    }, [displayOverride]);

    useEffect(() => {
        if (displayOverride !== undefined) {
            return;
        }

        if (!value.equals(new Decimal(displayValue || "0"))) {
            setDisplayValue(
                value.isZero() && !disabled && !unselectable
                    ? ""
                    : value.toString(),
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, displayOverride]);

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const newValue = event.target.value.replaceAll(",", ".");

            if (newValue === "") {
                setDisplayValue("");
                onValueChange(DECIMAL_ZERO);
                return;
            }

            if (newValue === ".") {
                setDisplayValue("0.");
                onValueChange(DECIMAL_ZERO);
                return;
            }

            if (!decimalRegexp.test(newValue)) {
                return;
            }

            setDisplayValue(newValue);

            try {
                const decimalValue = new Decimal(newValue);
                onValueChange(decimalValue);
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_) {
                // Invalid decimal, don't update
            }
        },
        [onValueChange],
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
