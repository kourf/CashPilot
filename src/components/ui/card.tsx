import * as React from "react"
import { cn } from "../../lib/utils"

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'frosted' | 'porcelain' | 'square-kpi';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = 'default', ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn(
      "transition-all duration-300",
      variant === 'default' && [
        "rounded-2xl border bg-card/90 dark:bg-card/75 text-card-foreground",
        "backdrop-blur-xl border-border/80 dark:border-white/[0.08]",
        "shadow-sm hover:shadow-md dark:shadow-none"
      ],
      (variant === 'frosted' || variant === 'square-kpi') && [
        "rounded-[28px] bg-white/[0.15] hover:bg-white/[0.20]",
        "backdrop-blur-2xl border border-white/30 text-white",
        "shadow-[0_14px_35px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.25)]",
        "flex flex-col justify-between overflow-hidden relative"
      ],
      variant === 'porcelain' && [
        "rounded-[32px] bg-white/90 dark:bg-white/95",
        "backdrop-blur-3xl border border-white/95 text-slate-900",
        "shadow-[0_20px_50px_rgba(0,0,0,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)]"
      ],
      className
    )} 
    {...props} 
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)} {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-base font-semibold leading-tight tracking-tight text-foreground", className)} {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-xs text-muted-foreground font-normal leading-relaxed", className)} {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 md:p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center p-5 md:p-6 pt-0 border-t border-border/40 dark:border-white/[0.04]", className)} {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
