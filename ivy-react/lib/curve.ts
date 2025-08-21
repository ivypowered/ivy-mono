import { Decimal } from "decimal.js-light";

export class Curve {
    // ================ Constant Product Curve Functions ================

    /**
     * Constant product swap calculation for given input amount (without fees)
     * Formula: (x + delta_x) * (y - delta_y) = x * y
     *
     * @param sourceAmount - Amount of source tokens to swap
     * @param swapSourceAmount - Current source token reserves
     * @param swapDestinationAmount - Current destination token reserves
     * @returns Amount of destination tokens received, or null if calculation fails
     */
    static swapBaseInput(
        sourceAmount: Decimal,
        swapSourceAmount: Decimal,
        swapDestinationAmount: Decimal,
    ): Decimal | null {
        const numerator = sourceAmount.mul(swapDestinationAmount);
        const denominator = swapSourceAmount.add(sourceAmount);

        if (denominator.isZero()) {
            return null;
        }

        const destinationAmountSwapped = numerator.div(denominator);
        return destinationAmountSwapped;
    }

    // ================ Sqrt Curve Functions ================

    /**
     * Compute the area under sqrt(cx) curve from a to b
     * Formula: (2/3) * sqrt(c) * (b^(3/2) - a^(3/2))
     *
     * @param c - Scale factor
     * @param a - Left bound
     * @param b - Right bound
     * @returns Area under the curve
     */
    static integrateSqrt(c: Decimal, a: Decimal, b: Decimal): Decimal {
        if (b.lte(a)) {
            return new Decimal(0);
        }

        const sqrtC = c.sqrt();
        const b15 = b.pow(1.5);
        const a15 = a.pow(1.5);
        const result = new Decimal(2).div(3).mul(sqrtC).mul(b15.sub(a15));

        return result;
    }

    /**
     * Given area under sqrt(cx) curve from a to b, compute the right bound b
     *
     * @param c - Scale factor (must be > 0)
     * @param area - Area under the curve
     * @param a - Left bound
     * @returns Right bound b, or null if scale is invalid
     */
    static getSqrtIntegralRightBound(
        c: Decimal,
        area: Decimal,
        a: Decimal,
    ): Decimal | null {
        if (c.lte(0)) {
            return null;
        }

        const sqrtC = c.sqrt();
        const a15 = a.pow(1.5);
        const term = a15.add(area.mul(3).div(sqrtC.mul(2)));
        const result = term.pow(new Decimal(2).div(3));

        return result;
    }

    /**
     * Calculate the current price of the sqrt curve
     *
     * @param supply - Current token supply
     * @param inputScale - The scaling factor for price calculations
     * @returns The current price of the curve
     */
    static currentPrice(supply: Decimal, inputScale: Decimal): Decimal {
        return supply.mul(inputScale).sqrt();
    }

    /**
     * Calculate the amount of reserve received for a token deposit amount
     *
     * @param supply - Current token supply
     * @param inputScale - The scaling factor for price calculations
     * @param tokenAmount - The number of tokens deposited
     * @returns The amount of reserve tokens received, or null if insufficient supply
     */
    static exactTokensIn(
        supply: Decimal,
        inputScale: Decimal,
        tokenAmount: Decimal,
    ): Decimal | null {
        if (tokenAmount.gt(supply)) {
            return null;
        }

        const newSupply = supply.sub(tokenAmount);

        return this.integrateSqrt(inputScale, newSupply, supply);
    }

    /**
     * Calculate the number of tokens received for a reserve deposit amount
     *
     * @param supply - Current token supply
     * @param maxSupply - Maximum token supply
     * @param inputScale - The scaling factor for price calculations
     * @param reserveAmount - The amount of reserve tokens to provide
     * @returns The number of tokens received, or null if exceeds maximum supply or invalid scale
     */
    static exactReserveIn(
        supply: Decimal,
        maxSupply: Decimal,
        inputScale: Decimal,
        reserveAmount: Decimal,
    ): Decimal | null {
        // Calculate the new supply directly
        const newSupply = this.getSqrtIntegralRightBound(
            inputScale,
            reserveAmount,
            supply,
        );

        if (!newSupply) {
            return null;
        }

        // Check max supply
        if (newSupply.gt(maxSupply)) {
            return null;
        }

        // Calculate actual tokens received
        return newSupply.sub(supply);
    }

    /**
     * Calculate a quote for a game token swap (constant product AMM)
     * Replicates the logic from get_game_quote in Rust
     */
    static calculateGameQuote(
        ivyBalance: Decimal,
        gameBalance: Decimal,
        inputAmount: Decimal,
        isBuy: boolean,
        ivyFeeBps: number,
        gameFeeBps: number,
        worldReserves: {
            ivySold: Decimal;
            ivyCurveMax: Decimal;
            curveInputScale: Decimal;
        },
    ): {
        outputAmount: Decimal;
        inputAmountUsd: Decimal;
        outputAmountUsd: Decimal;
        priceImpactBps: number;
    } | null {
        if (inputAmount.isZero()) {
            return {
                outputAmount: new Decimal(0),
                inputAmountUsd: new Decimal(0),
                outputAmountUsd: new Decimal(0),
                priceImpactBps: 0,
            };
        }

        // Check if there's liquidity
        if (ivyBalance.isZero() || gameBalance.isZero()) {
            return null;
        }

        // Calculate initial price for price impact
        const initialPrice = ivyBalance.div(gameBalance);

        // Setup reserves and fee rates based on swap direction
        const [inputReserve, outputReserve, inputFeeBps, outputFeeBps] = isBuy
            ? [ivyBalance, gameBalance, ivyFeeBps, gameFeeBps]
            : [gameBalance, ivyBalance, gameFeeBps, ivyFeeBps];

        // Apply input fee
        const inputFeeAmount = inputAmount.mul(inputFeeBps).div(10_000);
        const amountToCurve = inputAmount.sub(inputFeeAmount);

        if (amountToCurve.lte(0)) {
            return null;
        }

        // Calculate output from curve
        const amountFromCurve = this.swapBaseInput(
            amountToCurve,
            inputReserve,
            outputReserve,
        );

        if (!amountFromCurve || amountFromCurve.lte(0)) {
            return null;
        }

        // Apply output fee
        const outputFeeAmount = amountFromCurve.mul(outputFeeBps).div(10_000);
        const finalOutputAmount = amountFromCurve.sub(outputFeeAmount);

        // Calculate new balances for price impact
        const [newIvy, newGame] = isBuy
            ? [ivyBalance.add(amountToCurve), gameBalance.sub(amountFromCurve)]
            : [ivyBalance.sub(amountFromCurve), gameBalance.add(amountToCurve)];

        // Calculate price impact
        const newPrice =
            newIvy.gt(0) && newGame.gt(0) ? newIvy.div(newGame) : initialPrice;
        const priceImpactBps = initialPrice.gt(0)
            ? Math.min(
                  Math.floor(
                      newPrice
                          .sub(initialPrice)
                          .abs()
                          .div(initialPrice)
                          .mul(10_000)
                          .toNumber(),
                  ),
                  10_000,
              )
            : 0;

        let inputAmountUsd: Decimal;
        let outputAmountUsd: Decimal;

        if (isBuy) {
            // Input is IVY
            const ivyUsdValue = this.exactTokensIn(
                worldReserves.ivySold,
                worldReserves.curveInputScale,
                inputAmount,
            );

            if (!ivyUsdValue) {
                return null;
            }

            inputAmountUsd = ivyUsdValue;

            // Output is game tokens - calculate their value by:
            // 1. Feeless swap GAME -> IVY
            const ivyFromGame = this.swapBaseInput(
                finalOutputAmount,
                newGame,
                newIvy,
            );

            if (ivyFromGame && ivyFromGame.gt(0)) {
                // 2. Swap IVY -> USDC using world reserves
                const gameUsdValue = this.exactTokensIn(
                    worldReserves.ivySold,
                    worldReserves.curveInputScale,
                    ivyFromGame,
                );
                outputAmountUsd = gameUsdValue || new Decimal(0);
            } else {
                outputAmountUsd = new Decimal(0);
            }
        } else {
            // Input is game tokens - calculate their value
            // 1. Feeless swap GAME -> IVY
            const ivyFromGame = this.swapBaseInput(
                inputAmount,
                gameBalance,
                ivyBalance,
            );

            if (ivyFromGame && ivyFromGame.gt(0)) {
                // 2. Swap IVY -> USDC using world reserves
                const gameUsdValue = this.exactTokensIn(
                    worldReserves.ivySold,
                    worldReserves.curveInputScale,
                    ivyFromGame,
                );
                inputAmountUsd = gameUsdValue || new Decimal(0);
            } else {
                inputAmountUsd = new Decimal(0);
            }

            // Output is IVY
            const ivyUsdValue = this.exactTokensIn(
                worldReserves.ivySold,
                worldReserves.curveInputScale,
                finalOutputAmount,
            );

            if (!ivyUsdValue) {
                return null;
            }

            outputAmountUsd = ivyUsdValue;
        }

        return {
            outputAmount: finalOutputAmount,
            inputAmountUsd,
            outputAmountUsd,
            priceImpactBps,
        };
    }

    /**
     * Calculate a quote for IVY/USDC swap (sqrt curve)
     * Replicates the logic from get_world_quote in Rust
     */
    static calculateIvyQuote(
        ivySold: Decimal,
        ivyCurveMax: Decimal,
        inputScale: Decimal,
        inputAmount: Decimal,
        isBuy: boolean,
    ): {
        outputAmount: Decimal;
        inputAmountUsd: Decimal;
        outputAmountUsd: Decimal;
        priceImpactBps: number;
    } | null {
        const currentPrice = this.currentPrice(ivySold, inputScale);

        let outputAmount: Decimal | null;
        let newIvySold: Decimal;

        if (isBuy) {
            // Buying IVY with USDC
            outputAmount = this.exactReserveIn(
                ivySold,
                ivyCurveMax,
                inputScale,
                inputAmount,
            );

            if (!outputAmount) {
                return null;
            }

            newIvySold = ivySold.add(outputAmount);
        } else {
            // Selling IVY for USDC
            outputAmount = this.exactTokensIn(ivySold, inputScale, inputAmount);

            if (!outputAmount) {
                return null;
            }

            newIvySold = ivySold.sub(inputAmount);
        }

        const newPrice = this.currentPrice(newIvySold, inputScale);
        const priceImpactBps = currentPrice.gt(0)
            ? Math.min(
                  Math.floor(
                      newPrice
                          .sub(currentPrice)
                          .abs()
                          .div(currentPrice)
                          .mul(10_000)
                          .toNumber(),
                  ),
                  10_000,
              )
            : 0;

        // Calculate USD values
        let inputAmountUsd: Decimal;
        let outputAmountUsd: Decimal;

        if (isBuy) {
            // Input is USDC
            inputAmountUsd = inputAmount;
            // Output is IVY - calculate its USDC value at new price
            const ivyValue = this.exactTokensIn(
                newIvySold,
                inputScale,
                outputAmount,
            );

            if (!ivyValue) {
                return null;
            }

            outputAmountUsd = ivyValue;
        } else {
            // Input is IVY - calculate its USDC value at current price
            const ivyValue = this.exactTokensIn(
                ivySold,
                inputScale,
                inputAmount,
            );

            if (!ivyValue) {
                return null;
            }

            inputAmountUsd = ivyValue;
            // Output is USDC
            outputAmountUsd = outputAmount;
        }

        return {
            outputAmount,
            inputAmountUsd,
            outputAmountUsd,
            priceImpactBps,
        };
    }
}
