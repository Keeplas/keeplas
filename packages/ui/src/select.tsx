"use client";

import * as React from "react";
import * as SelectPrimitives from "@radix-ui/react-select";
import { cn } from "./lib/utils";

export interface SelectProps<Value = string> {
  /** "field": v2 web "App/Field" box (W06-3); default is the legacy look. */
  variant?: "default" | "field";
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (value: Value) => void;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  name?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
  triggerClassName?: string;
  popupClassName?: string;
  renderValue?: (value: Value) => React.ReactNode;
  align?: "start" | "center" | "end";
}

type ItemValueMap<Value> = Map<string, Value>;

const SelectVariant = React.createContext<"default" | "field">("default");

function collectItemValues<Value>(
  children: React.ReactNode,
  map: ItemValueMap<Value>,
) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: unknown;
      children?: React.ReactNode;
    };
    if (props.value !== undefined && props.value !== null) {
      map.set(String(props.value), props.value as Value);
    }
    if (props.children) {
      collectItemValues(props.children, map);
    }
  });
}

function SelectImpl<Value = string>({
  variant = "default",
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  name,
  id,
  children,
  className,
  triggerClassName,
  popupClassName,
  renderValue,
  align = "start",
}: SelectProps<Value>) {
  const valueMap = React.useMemo(() => {
    const map: ItemValueMap<Value> = new Map();
    collectItemValues(children, map);
    return map;
  }, [children]);

  const handleValueChange = React.useCallback(
    (stringValue: string) => {
      if (!onValueChange) return;
      const mapped = valueMap.get(stringValue);
      onValueChange(mapped !== undefined ? mapped : (stringValue as Value));
    },
    [onValueChange, valueMap],
  );

  const stringValue =
    value !== undefined && value !== null ? String(value) : undefined;
  const stringDefaultValue =
    defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : undefined;

  return (
    <SelectPrimitives.Root
      value={stringValue}
      defaultValue={stringDefaultValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitives.Trigger
        id={id}
        className={cn(
          "w-full flex items-center justify-between text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
          variant === "field"
            ? "h-[46px] gap-[8px] rounded-sm border border-border-default bg-bg-surface px-[14px] text-[15px] leading-[22px] text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus data-[placeholder]:text-text-subtle"
            : "gap-3 bg-surface-container-low border border-outline-variant rounded-xs px-4 py-3 text-sm text-on-surface font-body hover:border-outline focus:bg-surface-container-high focus:border-secondary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 data-[state=open]:bg-surface-container-high",
          triggerClassName,
          className,
        )}
      >
        <SelectPrimitives.Value
          placeholder={placeholder}
          asChild={renderValue !== undefined}
        >
          {renderValue !== undefined ? (
            <span className="truncate data-[placeholder]:text-outline-variant">
              {value !== undefined && value !== null
                ? renderValue(value)
                : placeholder}
            </span>
          ) : undefined}
        </SelectPrimitives.Value>
        <SelectPrimitives.Icon
          className={cn(
            "shrink-0",
            variant === "field" ? "text-text-muted" : "text-on-surface-variant",
          )}
        >
          <svg
            className={variant === "field" ? "size-[18px]" : "w-4 h-4"}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </SelectPrimitives.Icon>
      </SelectPrimitives.Trigger>
      <SelectPrimitives.Portal>
        <SelectPrimitives.Content
          position="popper"
          sideOffset={6}
          align={align}
          className={cn(
            "z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden",
            variant === "field"
              ? "rounded-md border border-border-default bg-bg-surface p-[6px] shadow-menu"
              : "bg-surface-container-lowest rounded-sm shadow-xl border border-outline-variant/20 p-1.5 font-body",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            popupClassName,
          )}
        >
          <SelectPrimitives.Viewport className="p-0 max-h-[min(24rem,var(--radix-select-content-available-height))] overflow-y-auto">
            <SelectVariant.Provider value={variant}>
              {children}
            </SelectVariant.Provider>
          </SelectPrimitives.Viewport>
        </SelectPrimitives.Content>
      </SelectPrimitives.Portal>
    </SelectPrimitives.Root>
  );
}

export const Select = SelectImpl as <Value = string>(
  props: SelectProps<Value>,
) => React.JSX.Element;

export interface SelectItemProps {
  value: unknown;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
  /**
   * Optional secondary line shown under the label inside the dropdown only.
   * The trigger keeps showing the main label.
   */
  description?: React.ReactNode;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, disabled, children, className, label, description }, ref) => {
    const variant = React.useContext(SelectVariant);
    return (
      <SelectPrimitives.Item
        ref={ref}
        value={String(value)}
        disabled={disabled}
        textValue={label}
        className={cn(
          "relative flex items-start gap-2 cursor-pointer outline-none select-none",
          "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
          variant === "field"
            ? "rounded-sm px-[10px] py-[8px] text-[14px] leading-[20px] text-text-primary data-[highlighted]:bg-bg-subtle data-[state=checked]:font-semibold"
            : "rounded-xs px-3 py-2 text-sm text-on-surface data-[highlighted]:bg-surface-container-high data-[highlighted]:text-primary data-[state=checked]:bg-secondary/10 data-[state=checked]:text-secondary data-[state=checked]:font-semibold",
          className,
        )}
      >
        <SelectPrimitives.ItemIndicator
          className={cn(
            "shrink-0 mt-0.5",
            variant === "field" ? "text-text-link" : "text-secondary",
          )}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.25}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m4.5 12.75 6 6 9-13.5"
            />
          </svg>
        </SelectPrimitives.ItemIndicator>
        <div className="flex-1 min-w-0">
          <SelectPrimitives.ItemText className="block truncate">
            {children}
          </SelectPrimitives.ItemText>
          {description && (
            <span className="block text-label-md text-on-surface-variant font-normal leading-snug mt-0.5">
              {description}
            </span>
          )}
        </div>
      </SelectPrimitives.Item>
    );
  },
);
SelectItem.displayName = "SelectItem";

export const SelectGroup = SelectPrimitives.Group;

export const SelectGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <SelectPrimitives.Label
    ref={ref}
    className={cn(
      "px-3 pt-3 pb-1.5 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant",
      className,
    )}
    {...props}
  />
));
SelectGroupLabel.displayName = "SelectGroupLabel";
