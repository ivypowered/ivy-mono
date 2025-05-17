/**
 * Returns the current Unix timestamp in seconds.
 */
function now() {
    return Math.floor(new Date().getTime() / 1_000);
}

/**
 * Returns the number of seconds elapsed since the given timestamp
 */
function elapsedSince(timestamp: number) {
    return Math.max(0, now() - timestamp);
}

/**
 * Generic cache for async data with background refresh capabilities.
 *
 * States:
 * - Empty: No data available (cache === null)
 * - Loading: Initial data fetch in progress (cache instanceof Promise)
 * - Fresh: Valid data within update interval
 * - Stale: Valid but outdated data (triggers background update)
 * - Expired: Data too old to use (forces reload)
 */
export class Cache<T> {
    // The function to get the value
    private f: () => Promise<T>;
    // The number of seconds after which we should update the value in background
    private updateInterval: number;
    // The number of seconds after which the value cannot be returned anymore
    private expiryInterval: number;
    // The value cache - can be in 3 states: null (Empty), Promise<T> (Loading), or T (Fresh/Stale)
    private cache: T | Promise<T> | null;
    // The Unix timestamp when the value was last updated
    private lastUpdated: number;
    // The controller for the background update, or null
    private updateController: { active: boolean } | null;

    constructor({
        f,
        updateInterval,
        expiryInterval,
    }: {
        f: () => Promise<T>;
        updateInterval: number;
        expiryInterval: number;
    }) {
        this.f = f;
        this.updateInterval = updateInterval;
        this.expiryInterval = expiryInterval;
        this.cache = null; // Start in Empty state
        this.lastUpdated = 0;
        this.updateController = null;
    }

    /**
     * Get cached value, refreshing if necessary based on the state machine logic
     */
    get(): Promise<T> {
        // STATE: Loading - return existing promise
        if (this.cache instanceof Promise) {
            return this.cache;
        }

        const elapsed = elapsedSince(this.lastUpdated);

        // STATE: Expired - clear cache to force reload
        if (elapsed > this.expiryInterval) {
            this.cache = null;
            if (this.updateController) {
                // Halt current update
                this.updateController.active = false;
                this.updateController = null;
            }
        }

        // STATE: Empty - must fetch new data
        if (this.cache === null) {
            this.cache = (async () => {
                try {
                    // Transition to Fresh state on success
                    this.cache = await this.f();
                    this.lastUpdated = now();
                    return this.cache;
                } catch (err) {
                    // Transition to Empty state on error
                    this.cache = null;
                    throw err;
                }
            })();
            // Now in Loading state
            return this.cache;
        }

        // STATE: Stale - return cached data but refresh in background
        if (elapsed > this.updateInterval && !this.updateController) {
            const c = {
                active: true,
            };
            this.updateController = c;
            (async () => {
                try {
                    // Update cache with fresh data
                    const data = await this.f();
                    if (c.active) {
                        this.cache = data;
                        this.lastUpdated = now();
                    }
                } catch (_) {
                    // Silently ignore errors in background updates
                    // Keep the stale-but-valid data instead
                } finally {
                    if (c.active) {
                        // Reset update controller to allow future background updates
                        this.updateController = null;
                    }
                }
            })();
        }

        // STATE: Fresh or Stale - return cached data immediately
        return Promise.resolve(this.cache);
    }
}
