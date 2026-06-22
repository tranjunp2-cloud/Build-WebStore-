import React from 'react';

export default function QnALoading() {
    return (
        <div className="flex flex-col gap-6 w-full animate-pulse pb-12">
            {/* Search Skeleton */}
            <div className="w-full">
                <div className="h-[46px] bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg w-full"></div>
            </div>

            {/* List Skeleton items - Group blocks matching Category containers */}
            <div className="w-full flex flex-col gap-6">
                {[1, 2].map((catIdx) => (
                    <div key={catIdx} className="flex flex-col gap-3">
                        {/* Category Title Skeleton */}
                        <div className="h-5 bg-[hsl(var(--card))] rounded w-48 mb-1"></div>
                        {/* Box container skeleton */}
                        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl overflow-hidden shadow-sm">
                            <div className="h-[52px] w-full bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]" />
                            <div className="h-[52px] w-full bg-[hsl(var(--card))] border-b border-[hsl(var(--border))]" />
                            <div className="h-[52px] w-full bg-[hsl(var(--card))]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
