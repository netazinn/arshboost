'use client'

import * as React from 'react'
import { Popover } from 'radix-ui'
import { cn } from '@/lib/utils'

const PopoverRoot    = Popover.Root
const PopoverTrigger = Popover.Trigger
const PopoverClose   = Popover.Close
const PopoverAnchor  = Popover.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof Popover.Content>,
  React.ComponentPropsWithoutRef<typeof Popover.Content>
>(({ className, align = 'center', sideOffset = 6, ...props }, ref) => (
  <Popover.Portal>
    <Popover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 rounded-xl border border-[#2a2a2a] bg-[#0a0a0a] shadow-2xl outline-none',
        'data-[state=open]:animate-in  data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2  data-[side=top]:slide-in-from-bottom-2',
        'data-[side=left]:slide-in-from-right-2  data-[side=right]:slide-in-from-left-2',
        className,
      )}
      {...props}
    />
  </Popover.Portal>
))
PopoverContent.displayName = Popover.Content.displayName

export { PopoverRoot, PopoverTrigger, PopoverContent, PopoverClose, PopoverAnchor }
