type PosthogWindow = {
    posthog?: {
        capture: (name: string, props: object) => void;
    };
};

type OnAssetComment = {
    asset: string;
    text: string;
};

type OnAssetSwap = {
    asset: string;
    inputSymbol: string;
    outputSymbol: string;
    inputAmount: number;
    outputAmount: number;
    usdValue: number;
};

type OnIvySwap = {
    inputSymbol: string;
    outputSymbol: string;
    inputAmount: number;
    outputAmount: number;
    usdValue: number;
};

/// Web analytics for Ivy
export class Analytics {
    private static capture(name: string, props: object) {
        if (typeof window === undefined) {
            return;
        }
        (window as PosthogWindow).posthog?.capture(name, props);
    }
    public static onAssetComment(data: OnAssetComment) {
        this.capture("asset_comment", data);
    }
    public static onAssetSwap(data: OnAssetSwap) {
        this.capture("asset_swap", data);
    }
    public static onIvySwap(data: OnIvySwap) {
        this.capture("ivy_swap", data);
    }
}
