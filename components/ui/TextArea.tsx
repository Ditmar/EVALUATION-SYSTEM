import { TextareaHTMLAttributes, forwardRef } from "react";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => {
    return <textarea ref={ref} className={`input ${className}`} {...props} />;
  }
);

TextArea.displayName = "TextArea";
