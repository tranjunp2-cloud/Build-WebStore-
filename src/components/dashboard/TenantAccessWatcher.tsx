'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function TenantAccessWatcher() {
    const [isEvicted, setIsEvicted] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const router = useRouter();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let debounceId: NodeJS.Timeout | null = null;

        const checkSession = async () => {
            if (isEvicted) return;
            try {
                const res = await fetch('/api/auth/session-check', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    if (data.action === 'force_logout') {
                        setIsEvicted(true);
                    }
                }
            } catch (error) {
                console.error('Failed to check session', error);
            }
        };

        const startPolling = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(checkSession, 60_000);
        };

        // Poll every 60s (was 15s — tenant revocation is rare)
        startPolling();

        // Debounced focus handler — prevents burst requests on rapid tab switching
        const handleFocus = () => {
            if (document.visibilityState !== 'visible') return;
            if (debounceId) clearTimeout(debounceId);
            debounceId = setTimeout(checkSession, 2_000);
        };

        // Pause polling when tab hidden, resume when visible
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') {
                if (intervalRef.current) clearInterval(intervalRef.current);
            } else {
                checkSession();
                startPolling();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (debounceId) clearTimeout(debounceId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [isEvicted]);

    const handleAcknowledge = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout request failed', error);
        } finally {
            document.cookie = 'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
            window.location.href = '/login';
        }
    };

    if (!isEvicted) return null;

    // A full-screen overlay that prevents any interaction with the underlying app
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[90%] max-w-md rounded-[20px] bg-[#0B1120] border border-white/[0.08] p-6 shadow-2xl flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <LogOut className="h-6 w-6 text-red-500" />
                </div>
                
                <h2 className="text-xl font-bold text-white mb-2 font-['Inter']">
                    Access Revoked
                </h2>
                
                <p className="text-[14px] text-[rgba(248,250,252,0.7)] leading-[1.5] mb-6 font-['Inter']">
                    Your access to this workspace has been removed by the workspace owner. You will now be logged out.
                </p>

                <button
                    onClick={handleAcknowledge}
                    disabled={isLoggingOut}
                    className="w-full h-11 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-[12px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {isLoggingOut ? 'Logging out...' : 'Acknowledge'}
                </button>
            </div>
        </div>
    );
}
