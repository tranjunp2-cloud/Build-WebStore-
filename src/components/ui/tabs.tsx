"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

// Two shared looks for every tab bar in the CMS:
// - pill: segmented control (the shadcn default).
// - underline: the dashboard nav style (Discounts / Team & Account / Products status…),
//   driven by the global `.dash-tab-trigger` class so the 2px teal underline + active/inactive
//   text colors are identical everywhere. Radix sets data-state on the trigger automatically.
const tabsListVariants = cva("", {
  variants: {
    variant: {
      pill: "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      underline:
        "flex w-full items-center justify-start gap-0 h-auto rounded-none bg-transparent p-0 overflow-x-auto no-scrollbar [border-bottom:1px_solid_var(--dash-divider)]",
    },
  },
  defaultVariants: { variant: "pill" },
})

const tabsTriggerVariants = cva(
  // `group` lets TabsCount react to this trigger's data-state (active tab → teal badge).
  "group inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        pill: "rounded-lg px-3 py-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow",
        underline:
          "dash-tab-trigger gap-2 px-4 pb-2.5 -mb-px rounded-none cursor-pointer bg-transparent shadow-none text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] data-[state=active]:text-[hsl(var(--primary))] data-[state=active]:bg-transparent data-[state=active]:shadow-none",
      },
    },
    defaultVariants: { variant: "pill" },
  },
)

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn(tabsListVariants({ variant }), className)} {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & VariantProps<typeof tabsTriggerVariants>
>(({ className, variant, ...props }, ref) => (
  <TabsPrimitive.Trigger ref={ref} className={cn(tabsTriggerVariants({ variant }), className)} {...props} />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// Count badge for tab labels (e.g. "Active (12)") — same circle shape as the
// sidebar nav badge (h-5 + min-w-[20px] + centered flex, not just padding) so a
// single-digit count renders as a true circle instead of an oval pill. Neutral
// tint matches Badge's "secondary" variant (bg-muted is too close to white to
// read); active tint (teal, via the `group` on TabsTrigger) matches the
// sidebar's active-item badge (bg-primary/15 + text-primary) exactly.
const TabsCount = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-400/[0.14] px-1.5 text-[11px] font-semibold leading-none text-slate-600 dark:text-slate-300",
        "group-data-[state=active]:bg-[hsl(var(--primary)/0.15)] group-data-[state=active]:text-[hsl(var(--primary))]",
        className
      )}
      {...props}
    />
  )
)
TabsCount.displayName = "TabsCount"

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsCount }
