'use client'

import { useState, useTransition, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GripVertical, Check, ArrowUp, ArrowDown, Settings } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { updateDashboardPreferences } from '@/app/(dashboard)/actions'
import { toast } from 'sonner'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

function SortableItem({
  id,
  label,
  value,
  visible,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: {
  id: string,
  label: string,
  value: string,
  visible: boolean,
  isFirst: boolean,
  isLast: boolean,
  onToggle: (id: string) => void,
  onMoveUp: (id: string) => void,
  onMoveDown: (id: string) => void,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`customize-item-${id}`}
      className="flex items-center gap-4 px-[17px] py-[14px] h-[70px] rounded-[12px] border border-solid border-[hsl(var(--border))] bg-[hsl(var(--background)/0.5)] hover:bg-[hsl(var(--secondary))] transition-colors"
    >
      {/* Drag Handle — desktop only */}
      <div
        className="hidden md:flex shrink-0 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] cursor-grab active:cursor-grabbing w-8 h-10 -ml-1 touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Custom Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(id); }}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-2 border-solid transition-colors duration-200 cursor-pointer ${visible ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : ''}`}
        style={!visible ? { borderColor: 'var(--dash-text-muted)', background: 'var(--dash-secondary-bg)' } : {}}
      >
        {visible && <Check className="h-3.5 w-3.5 !text-white stroke-[3px]" />}
      </button>

      {/* Text Content */}
      <div className="flex flex-col flex-1 text-left leading-tight">
        <span className="text-[14px] font-medium text-[hsl(var(--foreground))]">{label}</span>
        <span className="text-[12px] font-normal text-[hsl(var(--muted-foreground))] mt-0.5">{value}</span>
      </div>

      {/* Mobile Up/Down arrows — right side, horizontal per Figma FR-18 */}
      <button
        type="button"
        data-testid={`move-down-${id}`}
        disabled={isLast}
        onClick={(e) => { e.stopPropagation(); onMoveDown(id) }}
        className="flex md:hidden items-center justify-center shrink-0 size-5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowDown className="size-5" />
      </button>
      <button
        type="button"
        data-testid={`move-up-${id}`}
        disabled={isFirst}
        onClick={(e) => { e.stopPropagation(); onMoveUp(id) }}
        className="flex md:hidden items-center justify-center shrink-0 size-5 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowUp className="size-5" />
      </button>
    </div>
  )
}

export function DashboardCustomizeModal({ defaultPreferences }: { defaultPreferences?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t } = useI18n()
  
  const ALL_METRICS = useMemo(() => [
    { id: 'views', label: t.dashboard.overview.stats.views, value: '15,240' },
    { id: 'leads', label: t.dashboard.overview.stats.leads, value: '340' },
    { id: 'engagement', label: t.dashboard.overview.stats.engagement, value: '1,200' },
    // TODO: Re-enable when F10 Commerce is ready
    // { id: 'revenue', label: t.dashboard.overview.stats.revenue, value: 'RM 15,000' },
  ], [t])
  
  // Initialize stat order
  // TODO: Add 'revenue' back when F10 Commerce is ready
  const initialShown = defaultPreferences || ['views', 'leads', 'engagement']
  const initialHidden = ALL_METRICS.map(m => m.id).filter(id => !initialShown.includes(id))
  
  const [items, setItems] = useState([...initialShown, ...initialHidden])
  const [visibleItems, setVisibleItems] = useState(new Set(initialShown))

  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
        activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd(event: any) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const moveUp = (id: string) => {
    setItems((prev) => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      return arrayMove(prev, idx, idx - 1)
    })
  }

  const moveDown = (id: string) => {
    setItems((prev) => {
      const idx = prev.indexOf(id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      return arrayMove(prev, idx, idx + 1)
    })
  }

  const toggleVisibility = (id: string) => {
    const newVisible = new Set(visibleItems)
    if (newVisible.has(id)) {
      newVisible.delete(id)
    } else {
      newVisible.add(id)
    }
    setVisibleItems(newVisible)
  }

  const handleSave = () => {
    const newPreferences = items.filter(id => visibleItems.has(id))
    startTransition(async () => {
      const res = await updateDashboardPreferences(newPreferences)
      if (res.success) {
        toast.success(t.dashboard.overview.customizeModal.saving ? 'Saved' : 'Saved')
        setIsOpen(false)
      } else {
        toast.error('Failed to save')
      }
    })
  }

  return (
    <>
      <button data-testid="customize-dashboard-btn" onClick={() => setIsOpen(true)} className="flex items-center gap-[6px] rounded-[8px] border border-solid border-[hsl(var(--border))] bg-transparent px-[16px] py-[8px] text-[13px] font-semibold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-all leading-none">
        <Settings className="w-4 h-4 shrink-0" aria-hidden />
        <span>{t.dashboard.overview.customize}</span>
      </button>

      <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-hidden"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="w-full max-w-[672px] rounded-[16px] border border-solid border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="shrink-0 p-6 pb-6 border-b border-solid border-[hsl(var(--border))] flex flex-col gap-1.5">
              <h2 className="text-[20px] sm:text-[22px] font-bold text-[hsl(var(--foreground))] leading-tight">{t.dashboard.overview.customizeModal.title}</h2>
              <p className="text-[14px] text-[hsl(var(--muted-foreground))]">{t.dashboard.overview.customizeModal.description}</p>
            </div>
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                <div className="overflow-y-auto px-6 py-6 min-h-0 flex flex-col gap-4">
                  {items.map((id, index) => {
                    const metric = ALL_METRICS.find(m => m.id === id)
                    return metric ? (
                      <SortableItem
                        key={id}
                        id={id}
                        label={metric.label}
                        value={metric.value}
                        visible={visibleItems.has(id)}
                        isFirst={index === 0}
                        isLast={index === items.length - 1}
                        onToggle={toggleVisibility}
                        onMoveUp={moveUp}
                        onMoveDown={moveDown}
                      />
                    ) : null
                  })}
                </div>
              </SortableContext>
            </DndContext>

            {/* Footer */}
            <div className="mt-auto flex shrink-0 justify-end gap-3 px-6 py-4 border-t border-solid border-[hsl(var(--border))]">
              <Button
                variant="dashSecondary"
                size="dash"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
              >
                {t.dashboard.overview.customizeModal.cancel}
              </Button>
              <Button
                variant="dashPrimary"
                size="dash"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? t.dashboard.overview.customizeModal.saving : t.dashboard.overview.customizeModal.save}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
