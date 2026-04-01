import React from 'react';

export default function QnALoading() {
    return (
        <div className="flex flex-col gap-6 w-full animate-pulse pb-12">
            {/* Search Skeleton */}
            <div className="w-full">
                <div className="h-[46px] bg-[#161E2E] border border-[#1F2937] rounded-lg w-full"></div>
            </div>

            {/* List Skeleton items - Group blocks matching Category containers */}
            <div className="w-full flex flex-col gap-6">
                {[1, 2].map((catIdx) => (
                    <div key={catIdx} className="flex flex-col gap-3">
                        {/* Category Title Skeleton */}
                        <div className="h-5 bg-[#161E2E] rounded w-48 mb-1"></div>
                        {/* Box container skeleton */}
                        <div className="bg-[#161E2E] border border-[#1F2937] rounded-xl overflow-hidden shadow-sm">
                            <div className="h-[52px] w-full bg-[#161E2E] border-b border-[#1F2937]" />
                            <div className="h-[52px] w-full bg-[#161E2E] border-b border-[#1F2937]" />
                            <div className="h-[52px] w-full bg-[#161E2E]" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
