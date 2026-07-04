import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => {
    return (
      <select ref={ref} className={`input ${className}`} {...props}>
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
