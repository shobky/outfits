import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background,color,transform,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 select-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:opacity-90",
        surface: "bg-surface text-text border border-border shadow-soft hover:bg-surface-2",
        ghost: "text-text hover:bg-surface-2",
        accent: "bg-accent text-accent-fg hover:opacity-90",
        danger: "bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        sm: "h-8 px-3 text-[13px] rounded-full",
        md: "h-10 px-4 text-sm rounded-full",
        lg: "h-13 px-6 text-[15px] rounded-full",
        icon: "size-10 rounded-full",
        "icon-sm": "size-8 rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
