'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { EyeOff, X, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface UnpublishModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUnpublish: () => void;
    isPublishing: boolean;
}

export function UnpublishModal({
    isOpen,
    onOpenChange,
    onUnpublish,
    isPublishing,
}: UnpublishModalProps) {
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
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 border border-red-500/30 text-red-400">
                                        <EyeOff className="h-8 w-8" />
                                    </div>
                                    
                                    <Dialog.Title className="mb-2 text-2xl font-bold tracking-tight text-white">
                                        Xác nhận tạm ẩn website
                                    </Dialog.Title>
                                    
                                    <Dialog.Description className="mb-6 text-sm text-gray-400">
                                        Khách hàng truy cập vào domain của bạn sẽ thấy giao diện <strong>Đang bảo trì (Maintenance Mode)</strong>. Bạn (chủ cửa hàng) vẫn có thể xem trước website thông qua trình chỉnh sửa Editor. Bạn chắc chắn muốn gỡ website xuống chứ?
                                    </Dialog.Description>

                                    {/* Actions */}
                                    <div className="flex w-full justify-end gap-3">
                                        <Dialog.Close asChild>
                                            <button className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white transition-colors">
                                                Hủy
                                            </button>
                                        </Dialog.Close>
                                        <button
                                            onClick={onUnpublish}
                                            disabled={isPublishing}
                                            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                                        >
                                            {isPublishing ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" /> Đang xử lý...</>
                                            ) : (
                                                'Bật chế độ Tạm ẩn'
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
