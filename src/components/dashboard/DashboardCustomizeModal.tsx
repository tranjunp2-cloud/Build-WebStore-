'use client'

import { useState, useTransition, useMemo } from 'react'
import { Settings2, GripVertical, Eye, EyeOff } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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

function SortableItem({ id, label, visible, onToggle }: { id: string, label: string, visible: boolean, onToggle: (id: string) => void }) {
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
    <div ref={setNodeRef} style={style} className={`flex items-center justify-between p-3 mb-2 rounded-lg border border-white/10 ${visible ? 'bg-[#1E293B]' : 'bg-[#0F172A] opacity-60'}`}>
      <div className="flex items-center gap-3">
        <button type="button" {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300">
          <GripVertical className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-white">{label}</span>
      </div>
      <button type="button" onClick={() => onToggle(id)} className="text-gray-400 hover:text-white">
        {visible ? <Eye className="h-4 w-4 text-blue-400" /> : <EyeOff className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function DashboardCustomizeModal({ defaultPreferences }: { defaultPreferences?: string[] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t } = useI18n()
  
  const ALL_METRICS = useMemo(() => [
    { id: 'views', label: t.dashboard.overview.stats.views },
    { id: 'leads', label: t.dashboard.overview.stats.leads },
    { id: 'engagement', label: t.dashboard.overview.stats.engagement },
    { id: 'revenue', label: t.dashboard.overview.stats.revenue },
  ], [t])
  
  // Initialize stat order
  const initialShown = defaultPreferences || ['views', 'leads', 'engagement', 'revenue']
  const initialHidden = ALL_METRICS.map(m => m.id).filter(id => !initialShown.includes(id))
  
  const [items, setItems] = useState([...initialShown, ...initialHidden])
  const [visibleItems, setVisibleItems] = useState(new Set(initialShown))

  const sensors = useSensors(
    useSensor(PointerSensor),
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
      <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
        <Settings2 className="h-4 w-4" /> {t.dashboard.overview.customize}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-1">{t.dashboard.overview.customizeModal.title}</h2>
            <p className="text-sm text-gray-400 mb-6">{t.dashboard.overview.customizeModal.description}</p>
            
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                  {items.map((id) => {
                    const metric = ALL_METRICS.find(m => m.id === id)
                    return metric ? (
                      <SortableItem 
                        key={id} 
                        id={id} 
                        label={metric.label} 
                        visible={visibleItems.has(id)}
                        onToggle={toggleVisibility}
                      />
                    ) : null
                  })}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white" disabled={isPending}>
                {t.dashboard.overview.customizeModal.cancel}
              </button>
              <button onClick={handleSave} disabled={isPending} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                {isPending ? t.dashboard.overview.customizeModal.saving : t.dashboard.overview.customizeModal.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
