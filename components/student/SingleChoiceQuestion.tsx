interface Option {
  id: string;
  text: string;
}

export function SingleChoiceQuestion({
  name,
  options,
  value,
  onChange,
  disabled,
}: {
  name: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
            value === opt.id ? "border-brand-500 bg-brand-50" : "border-slate-200"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            disabled={disabled}
          />
          {opt.text}
        </label>
      ))}
    </div>
  );
}
