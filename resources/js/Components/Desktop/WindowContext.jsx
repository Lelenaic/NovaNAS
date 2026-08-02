import { createContext, useContext, useState, useCallback } from 'react';

const WindowContext = createContext(undefined);

const HEADER_HEIGHT = 76;
const SIDEBAR_WIDTH = 292;
const HEADER_Z_INDEX = 1000;

export function WindowProvider({ children }) {
    const [windows, setWindows] = useState([]);
    const [maxZIndex, setMaxZIndex] = useState(100);

    const openWindow = useCallback((appId, title, icon = null) => {
        const existingWindow = windows.find((w) => w.appId === appId);

        if (existingWindow) {
            if (existingWindow.minimized) {
                setWindows((prev) =>
                    prev.map((w) =>
                        w.id === existingWindow.id
                            ? { ...w, minimized: false, zIndex: maxZIndex + 1 }
                            : w
                    )
                );
                setMaxZIndex((prev) => prev + 1);
            } else {
                focusWindow(existingWindow.id);
            }
            return;
        }

        const newWindow = {
            id: `${appId}-${Date.now()}`,
            appId,
            title,
            icon,
            x: 120 + windows.length * 30,
            y: 80 + windows.length * 30,
            width: 1100,
            height: 650,
            minimized: false,
            maximized: false,
            zIndex: maxZIndex + 1,
        };

        setWindows((prev) => [...prev, newWindow]);
        setMaxZIndex((prev) => prev + 1);
    }, [windows, maxZIndex]);

    const closeWindow = useCallback((id) => {
        setWindows((prev) => prev.filter((w) => w.id !== id));
    }, []);

    const minimizeWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, minimized: true } : w))
        );
    }, []);

    const maximizeWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => {
                if (w.id !== id) return w;

                if (w.maximized) {
                    return {
                        ...w,
                        maximized: false,
                        x: w.prevPosition?.x ?? 120,
                        y: w.prevPosition?.y ?? 80,
                        width: w.prevPosition?.width ?? 1100,
                        height: w.prevPosition?.height ?? 650,
                        zIndex: maxZIndex + 1,
                    };
                }

                return {
                    ...w,
                    maximized: true,
                    prevPosition: { x: w.x, y: w.y, width: w.width, height: w.height },
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    zIndex: HEADER_Z_INDEX + 1,
                };
            })
        );
        setMaxZIndex((prev) => prev + 1);
    }, [maxZIndex]);

    const restoreWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, minimized: false, zIndex: maxZIndex + 1 } : w))
        );
        setMaxZIndex((prev) => prev + 1);
    }, [maxZIndex]);

    const focusWindow = useCallback((id) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, zIndex: maxZIndex + 1 } : w))
        );
        setMaxZIndex((prev) => prev + 1);
    }, [maxZIndex]);

    const moveWindow = useCallback((id, x, y) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, x, y } : w))
        );
    }, []);

    const resizeWindow = useCallback((id, width, height) => {
        setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, width, height } : w))
        );
    }, []);

    const getWindowById = useCallback((id) => {
        return windows.find((w) => w.id === id);
    }, [windows]);

    return (
        <WindowContext.Provider
            value={{
                windows,
                maxZIndex,
                openWindow,
                closeWindow,
                minimizeWindow,
                maximizeWindow,
                restoreWindow,
                focusWindow,
                moveWindow,
                resizeWindow,
                getWindowById,
            }}
        >
            {children}
        </WindowContext.Provider>
    );
}

export function useWindow() {
    const context = useContext(WindowContext);
    if (context === undefined) {
        throw new Error('useWindow must be used within a WindowProvider');
    }
    return context;
}
