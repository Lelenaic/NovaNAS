import { useEffect } from 'react';
import { DesktopLayout } from '@/Components/Desktop/DesktopLayout';
import { useBadges } from '@/Components/Desktop/BadgeContext';

export default function Home({ version, desktopApps, userIconOrders, appBadges }) {
    const { setBadge } = useBadges();

    useEffect(() => {
        // Set badges from server
        Object.entries(appBadges || {}).forEach(([appId, count]) => {
            setBadge(appId, count);
        });
    }, [appBadges, setBadge]);

    return <DesktopLayout version={version} desktopApps={desktopApps} userIconOrders={userIconOrders} />;
}
