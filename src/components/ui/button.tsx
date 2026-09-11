import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium",
          "transition-all duration-200 active:scale-[0.98] select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-primary text-primary-foreground shadow-sm hover:shadow-md hover:bg-primary/95 dark:hover:shadow-glow-cyan/20": variant === "default",
            "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90": variant === "destructive",
            "border border-border/80 bg-background/80 hover:bg-secondary/80 dark:border-white/[0.1] dark:hover:bg-white/[0.08] text-foreground": variant === "outline",
            "bg-secondary text-secondary-foreground hover:bg-secondary/90 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]": variant === "secondary",
            "hover:bg-muted/80 dark:hover:bg-white/[0.06] text-foreground/80 hover:text-foreground": variant === "ghost",
            "text-primary underline-offset-4 hover:underline": variant === "link",
            "glass border border-white/20 dark:border-white/10 hover:bg-white/90 dark:hover:bg-white/[0.12] text-foreground shadow-glass": variant === "glass",
            "h-10 px-4 py-2": size === "default",
            "h-8.5 rounded-lg px-3 text-xs": size === "sm",
            "h-11 rounded-xl px-6 text-base font-semibold": size === "lg",
            "h-9.5 w-9.5 p-0": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
