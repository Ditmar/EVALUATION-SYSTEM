interface Option {
  id: string;
  text: string;
}

export function MultipleChoiceQuestion({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.id}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
            value.includes(opt.id) ? "border-brand-500 bg-brand-50" : "border-slate-200"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(opt.id)}
            onChange={() => toggle(opt.id)}
            disabled={disabled}
          />
          {opt.text}
        </label>
      ))}
    </div>
  );
}
