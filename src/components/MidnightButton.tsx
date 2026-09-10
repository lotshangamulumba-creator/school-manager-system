import React from 'react';

interface MidnightButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const MidnightButton: React.FC<MidnightButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}) => {
  // Light midnight blue theme:
  // Base: #1E3A5F, Hover: #2A5288, Active: #152942 with smooth surveillance effect (glow & transition)
  const baseClasses =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-xs md:text-sm px-3.5 py-2 gap-2',
    lg: 'text-sm md:text-base px-4 py-2.5 gap-2.5',
  };

  const variantClasses = {
    // Primary: Light Midnight Blue with hover/surveillance effect
    primary:
      'bg-[#1E3A5F] text-white hover:bg-[#2A5288] active:bg-[#152942] border border-[#234574] shadow-sm hover:shadow-[0_0_12px_rgba(42,82,136,0.45)] hover:border-[#3b6cb0] focus:ring-[#1E3A5F]',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 focus:ring-slate-400',
    outline:
      'bg-transparent text-[#1E3A5F] border border-[#1E3A5F] hover:bg-[#1E3A5F]/10 active:bg-[#1E3A5F]/20 focus:ring-[#1E3A5F]',
    danger:
      'bg-rose-700 text-white hover:bg-rose-800 active:bg-rose-900 border border-rose-800 focus:ring-rose-600',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
