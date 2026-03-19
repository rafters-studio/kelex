"use client";

import {
  type ButtonHTMLAttributes,
  createContext,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---- Field ----

interface FieldProps {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function Field({
  label,
  description,
  required,
  error,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium leading-none">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
      {description && <p className="text-sm text-gray-500">{description}</p>}
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ---- Button ----

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
}

const btnBase =
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

const btnVariants: Record<string, string> = {
  default:
    "bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-200",
  outline:
    "border border-gray-300 bg-transparent hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800",
  ghost: "hover:bg-gray-100 dark:hover:bg-gray-800",
  destructive: "bg-red-500 text-white hover:bg-red-600",
};

const btnSizes: Record<string, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3 text-xs",
  lg: "h-11 px-8",
  icon: "h-10 w-10",
};

export function Button({
  variant = "default",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={[btnBase, btnVariants[variant], btnSizes[size], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

// ---- Label ----

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export function Label({ htmlFor, children, className = "" }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none ${className}`}
    >
      {children}
    </label>
  );
}

// ---- Input ----

export function Input({
  className = "",
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 ${className}`}
      {...props}
    />
  );
}

// ---- Textarea ----

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`flex min-h-20 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 ${className}`}
      {...props}
    />
  );
}

// ---- Checkbox ----

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  className = "",
}: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked ?? false}
      onChange={() => onCheckedChange?.(!checked)}
      className={`h-4 w-4 shrink-0 rounded-sm border border-gray-300 accent-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-gray-50 ${className}`}
    />
  );
}

// ---- Select (compound component) ----

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectCtx = createContext<SelectContextValue>({
  value: "",
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
});

function SelectRoot({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <SelectCtx.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

function SelectTrigger({ children }: { children: ReactNode }) {
  const { open, setOpen } = useContext(SelectCtx);
  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className="flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700"
    >
      {children}
      <svg
        aria-hidden="true"
        className="h-4 w-4 opacity-50"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const { value } = useContext(SelectCtx);
  return (
    <span className={value ? "" : "text-gray-400"}>{value || placeholder}</span>
  );
}

function SelectContent({ children }: { children: ReactNode }) {
  const { open } = useContext(SelectCtx);
  if (!open) return null;
  return (
    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
      {children}
    </div>
  );
}

function SelectItem({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const { value: selected, onValueChange, setOpen } = useContext(SelectCtx);
  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={`flex w-full items-center px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${selected === value ? "bg-gray-100 dark:bg-gray-800" : ""}`}
    >
      {children}
    </button>
  );
}

export const Select = Object.assign(SelectRoot, {
  Trigger: SelectTrigger,
  Value: SelectValue,
  Content: SelectContent,
  Item: SelectItem,
});

// ---- RadioGroup (compound component) ----

interface RadioGroupContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const RadioGroupCtx = createContext<RadioGroupContextValue>({
  value: "",
  onValueChange: () => {},
});

function RadioGroupRoot({
  value,
  onValueChange,
  children,
  className = "",
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadioGroupCtx.Provider value={{ value, onValueChange }}>
      <div role="radiogroup" className={`flex flex-col gap-2 ${className}`}>
        {children}
      </div>
    </RadioGroupCtx.Provider>
  );
}

function RadioGroupItem({ value, id }: { value: string; id?: string }) {
  const { value: selected, onValueChange } = useContext(RadioGroupCtx);
  return (
    <input
      type="radio"
      id={id}
      checked={selected === value}
      onChange={() => onValueChange(value)}
      className="h-4 w-4 accent-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:accent-gray-50"
    />
  );
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Item: RadioGroupItem,
});

// ---- Slider ----

interface SliderProps {
  value?: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
}: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value?.[0] ?? min}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      className={`w-full accent-gray-900 dark:accent-gray-50 ${className}`}
    />
  );
}

// ---- DatePicker ----

interface DatePickerProps {
  value?: Date;
  onValueChange?: (value: Date | undefined) => void;
  className?: string;
}

export function DatePicker({
  value,
  onValueChange,
  className = "",
}: DatePickerProps) {
  const str = value instanceof Date ? value.toISOString().split("T")[0] : "";
  return (
    <input
      type="date"
      value={str}
      onChange={(e) =>
        onValueChange?.(e.target.value ? new Date(e.target.value) : undefined)
      }
      className={`flex h-10 w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 ${className}`}
    />
  );
}

// ---- Card ----

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: CardProps) {
  return (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-lg font-semibold leading-none tracking-tight">
      {children}
    </h3>
  );
}

export function CardContent({ className = "", children }: CardProps) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}
