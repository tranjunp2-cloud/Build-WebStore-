'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Rocket, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

interface PrePublishModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onPublish: () => void;
    isPublishing: boolean;
    hasUnsavedChanges: boolean;
}

export function PrePublishModal({
    isOpen,
    onOpenChange,
    onPublish,
    isPublishing,
    hasUnsavedChanges
}: PrePublishModalProps) {
    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {isOpen && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                            />
                        </Dialog.Overlay>
                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl focus:outline-none"
                            >
                                <Dialog.Close className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                                    <X className="h-5 w-5" />
                                </Dialog.Close>

                                <div className="flex flex-col text-left">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400">
                                        <Rocket className="h-8 w-8" />
                                    </div>
                                    
                                    <Dialog.Title className="mb-2 text-2xl font-bold tracking-tight text-white">
                                        Chuẩn bị xuất bản
                                    </Dialog.Title>
                                    
                                    <Dialog.Description className="mb-6 text-sm text-gray-400">
                                        Xem lại danh mục sau trước khi đưa website của bạn lên mạng nhé.
                                    </Dialog.Description>

                                    {/* Checklist */}
                                    <div className="mb-8 flex flex-col gap-3">
                                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                                            <span className="text-sm font-medium text-white">Đã có trang chủ (Home)</span>
                                        </div>
                                        
                                        <div className={cn("flex items-center gap-3 rounded-xl border p-3 transition-colors",
                                            hasUnsavedChanges ? "border-yellow-500/30 bg-yellow-500/10" : "border-white/10 bg-white/5"
                                        )}>
                                            {hasUnsavedChanges ? (
                                                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
                                            ) : (
                                                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className={cn("text-sm font-medium", hasUnsavedChanges ? "text-yellow-500" : "text-white")}>
                                                    {hasUnsavedChanges ? "Bạn đang có thay đổi chưa lưu" : "Đã lưu lại thiết kế"}
                                                </span>
                                                {hasUnsavedChanges && (
                                                    <span className="text-xs text-yellow-500/80">Bạn nên lưu bài trước khi Publish.</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
                                            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-yellow-500">Chưa tối ưu SEO</span>
                                                <span className="text-xs text-yellow-500/80">Trang của bạn cần điền SEO Meta Score (Optional).</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex w-full justify-end gap-3">
                                        <Dialog.Close asChild>
                                            <button className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
                                                Hủy
                                            </button>
                                        </Dialog.Close>
                                        <button
                                            onClick={onPublish}
                                            disabled={isPublishing}
                                            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
                                        >
                                            {isPublishing ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                                            ) : (
                                                'Publish ngay'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    )
}
