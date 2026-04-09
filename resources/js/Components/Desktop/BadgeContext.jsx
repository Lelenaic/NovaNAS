import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePage } from '@inertiajs/react';

// Badge context for managing notification badges on app icons
const BadgeContext = createContext();

// Badge provider component
export function BadgeProvider({ children }) {
    const [badges, setBadges] = useState({});

    // Load badges from localStorage on mount
    useEffect(() => {
        const savedBadges = localStorage.getItem('app_badges');
        if (savedBadges) {
            try {
                setBadges(JSON.parse(savedBadges));
            } catch (error) {
                console.error('Failed to parse saved badges:', error);
            }
        }
    }, []);

    // Save badges to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('app_badges', JSON.stringify(badges));
    }, [badges]);

    // Set badge count for an app
    const setBadge = useCallback((appId, count) => {
        setBadges(prev => {
            const newBadges = { ...prev };
            if (count > 0) {
                newBadges[appId] = count;
            } else {
                delete newBadges[appId];
            }
            return newBadges;
        });
    }, []);

    // Clear badge for an app
    const clearBadge = useCallback((appId) => {
        setBadges(prev => {
            const newBadges = { ...prev };
            delete newBadges[appId];
            return newBadges;
        });
    }, []);

    // Refresh badges from server (useful after operations that might change badge counts)
    const refreshBadges = useCallback(async () => {
        try {
            const response = await fetch('/api/badges');
            if (response.ok) {
                const serverBadges = await response.json();
                setBadges(serverBadges);
            }
        } catch (error) {
            console.error('Failed to refresh badges:', error);
        }
    }, []);

    // Get badge count for an app
    const getBadge = useCallback((appId) => {
        return badges[appId] || 0;
    }, [badges]);

    // Clear all badges
    const clearAllBadges = useCallback(() => {
        setBadges({});
    }, []);

    // Make refreshBadges available globally for components that need to refresh badges
    useEffect(() => {
        window.refreshBadges = refreshBadges;
        return () => {
            delete window.refreshBadges;
        };
    }, [refreshBadges]);

    const value = {
        badges,
        setBadge,
        clearBadge,
        getBadge,
        clearAllBadges,
        refreshBadges,
    };

    return (
        <BadgeContext.Provider value={value}>
            {children}
        </BadgeContext.Provider>
    );
}

// Hook to use badge context
export function useBadges() {
    const context = useContext(BadgeContext);
    if (!context) {
        throw new Error('useBadges must be used within a BadgeProvider');
    }
    return context;
}