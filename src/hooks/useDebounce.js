import { useState, useEffect } from 'react';

export function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);

    // Deep compare is not strictly needed if we are okay with the timer resetting on reference change.
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}
