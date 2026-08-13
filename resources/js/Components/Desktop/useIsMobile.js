import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

function getIsMobile() {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(getIsMobile);

    useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

        const handler = (e) => setIsMobile(e.matches);
        handler(mql);

        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    return isMobile;
}
