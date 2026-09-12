import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "income" | "fixed" | "variable" | "savings"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantClasses: Record<string, string> = {
    default: "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
    secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
    outline: "text-foreground border border-border/60",
    income: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-medium",
    fixed: "bg-blue-500/10 text-blue-500 border border-blue-500/20 font-medium",
    variable: "bg-amber-500/10 text-amber-500 border border-amber-500/20 font-medium",
    savings: "bg-purple-500/10 text-purple-500 border border-purple-500/20 font-medium",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variantClasses[variant] || variantClasses.default,
        className
      )}
      {...props}
    />
  )
}

export { Badge }
