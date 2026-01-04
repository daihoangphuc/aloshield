import React from "react";
import { Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: "bg-gradient-to-r from-[var(--primary)] to-[#0891b2] text-white shadow-lg shadow-[var(--primary-glow)] hover:scale-[1.02] active:scale-[0.98] border border-transparent",
      secondary: "bg-[#161b22] text-white border border-[#30363d] hover:bg-[#1c2128] hover:border-[#8b5cf6]/30 shadow-none hover:shadow-[0_0_20px_var(--accent-glow)]",
      ghost: "bg-transparent text-[var(--text-secondary)] hover:text-white hover:bg-white/5 shadow-none border border-transparent",
      danger: "bg-gradient-to-r from-[var(--danger)] to-[#e11d48] text-white shadow-lg shadow-[var(--danger-glow)] hover:scale-[1.02] active:scale-[0.98] border border-transparent",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-lg",
      md: "h-10 px-4 text-sm rounded-xl",
      lg: "h-12 px-6 text-base rounded-2xl",
      icon: "h-10 w-10 p-2 rounded-xl flex items-center justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={isLoading || disabled}
        className={cn(
          "font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
