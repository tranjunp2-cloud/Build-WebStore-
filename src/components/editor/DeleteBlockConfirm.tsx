'use client'

import { useEffect, useRef } from 'react'

interface DeleteBlockConfirmProps {
    blockName: string
    onConfirm: () => void
    onCancel: () => void
    anchorRect: { top: number; left: number; width: number }
}

export function DeleteBlockConfirm({ blockName, onConfirm, onCancel, anchorRect }: DeleteBlockConfirmProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter') onConfirm()
        }
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onCancel()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [onCancel, onConfirm])

    return (
        <div
            ref={ref}
            className="absolute z-[60] w-[240px] rounded-xl border border-white/10 bg-[#1E293B] p-3 shadow-2xl animate-in fade-in duration-150"
            style={{
                top: anchorRect.top - 8,
                left: anchorRect.left + anchorRect.width / 2,
                transform: 'translate(-50%, -100%)',
            }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <p className="mb-3 text-xs text-slate-300">
                Delete <span className="font-semibold capitalize text-white">{blockName.replace(/-/g, ' ')}</span>? This block will be removed.
            </p>
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-white/5"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                >
                    Delete
                </button>
            </div>
        </div>
    )
}
