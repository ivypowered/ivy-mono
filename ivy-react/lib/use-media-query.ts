import { useEffect, useLayoutEffect, useState } from "react";

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

type UseMediaQueryOptions = {
    defaultValue?: boolean;
    initializeWithValue?: boolean;
};

const IS_SERVER = typeof window === "undefined";

export function useMediaQuery(
    query: string,
    {
        defaultValue = false,
        initializeWithValue = true,
    }: UseMediaQueryOptions = {}
): boolean {
    const getMatches = (query: string): boolean => {
        return IS_SERVER ? defaultValue : window.matchMedia(query).matches;
    };

    const [matches, setMatches] = useState<boolean>(() => {
        return initializeWithValue ? getMatches(query) : defaultValue;
    });

    useIsomorphicLayoutEffect(() => {
        const matchMedia = window.matchMedia(query);
        const handleChange = () => setMatches(getMatches(query));

        handleChange();

        // Support for older Safari versions
        if (matchMedia.addListener) {
            matchMedia.addListener(handleChange);
            return () => matchMedia.removeListener(handleChange);
        } else {
            matchMedia.addEventListener("change", handleChange);
            return () => matchMedia.removeEventListener("change", handleChange);
        }
    }, [query]);

    return matches;
}
