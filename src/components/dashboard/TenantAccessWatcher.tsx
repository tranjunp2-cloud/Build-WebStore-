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
        // Function to check session
        const checkSession = async () => {
            if (isEvicted) return; // Stop checking if already evicted

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

        // Check every 15 seconds
        intervalRef.current = setInterval(checkSession, 15000);

        // Also check when window regains focus
        const handleFocus = () => checkSession();
        window.addEventListener('focus', handleFocus);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener('focus', handleFocus);
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
