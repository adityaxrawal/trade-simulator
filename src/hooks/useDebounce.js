import { useState, useEffect } from 'react';

export function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    // Deep compare avoids unnecessary resets for identical objects recreating on every render
    const stringified = JSON.stringify(value, (k, v) =>
        typeof v === 'number' && !isFinite(v) ? (isNaN(v) ? 'NaN' : (v > 0 ? 'Infinity' : '-Infinity')) : v
    );

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stringified, delay]);

    return debouncedValue;
}
