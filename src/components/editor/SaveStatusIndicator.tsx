'use client'

import React, { useEffect, useState } from 'react'
import { Cloud, CloudUpload, CloudOff, AlertCircle, Loader2 } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

export const SaveStatusIndicator: React.FC = () => {
    const { saveStatus, lastSavedAt, hasUnsavedChanges } = useEditorStore()
    const [timeAgo, setTimeAgo] = useState<string>('')

    useEffect(() => {
        if (!lastSavedAt) return

        const updateTime = () => {
            setTimeAgo(formatDistanceToNow(lastSavedAt, { addSuffix: true }))
        }

        updateTime()
        const interval = setInterval(updateTime, 30000) // Update every 30s
        return () => clearInterval(interval)
    }, [lastSavedAt])

    const renderStatus = () => {
        switch (saveStatus) {
            case 'saving':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-1.5 text-blue-400"
                    >
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="text-xs font-medium hidden md:inline">Saving...</span>
                    </motion.div>
                )
            case 'saved':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-1.5 text-green-400"
                    >
                        <Cloud className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium hidden md:inline">
                            {lastSavedAt ? `Saved ${timeAgo}` : 'Saved'}
                        </span>
                    </motion.div>
                )
            case 'error':
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="flex items-center gap-1.5 text-red-400"
                    >
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium hidden md:inline">Not saved</span>
                    </motion.div>
                )
            case 'idle':
                if (hasUnsavedChanges) {
                    return (
                        <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="flex items-center gap-1.5 text-yellow-400/80"
                        >
                            <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
                            <span className="text-xs font-medium hidden md:inline">Draft saving in 3s...</span>
                        </motion.div>
                    )
                }
                return null
            default:
                return null
        }
    }

    return (
        <div className="flex h-8 items-center px-2">
            <AnimatePresence mode="wait">
                {renderStatus()}
            </AnimatePresence>
        </div>
    )
}
