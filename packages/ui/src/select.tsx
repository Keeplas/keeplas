"use client";

import * as React from "react";
import * as SelectPrimitives from "@radix-ui/react-select";
import { cn } from "./lib/utils";

export interface SelectProps<Value = string> {
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
          "w-full flex items-center justify-between gap-3 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-sm text-left text-on-surface font-body transition-colors",
          "hover:border-outline focus:bg-surface-container-high focus:border-secondary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
          "data-[state=open]:bg-surface-container-high",
          "disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
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
        <SelectPrimitives.Icon className="shrink-0 text-on-surface-variant">
          <svg
            className="w-4 h-4"
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
            "z-[60] min-w-[var(--radix-select-trigger-width)] max-h-[min(24rem,var(--radix-select-content-available-height))]",
            "bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 p-1.5 font-body overflow-hidden",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            popupClassName,
          )}
        >
          <SelectPrimitives.Viewport className="p-0">
            {children}
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
  ({ value, disabled, children, className, label, description }, ref) => (
    <SelectPrimitives.Item
      ref={ref}
      value={String(value)}
      disabled={disabled}
      textValue={label}
      className={cn(
        "relative flex items-start gap-2 rounded-lg px-3 py-2 text-sm text-on-surface cursor-pointer outline-none select-none",
        "data-[highlighted]:bg-surface-container-high data-[highlighted]:text-primary",
        "data-[state=checked]:bg-secondary/10 data-[state=checked]:text-secondary data-[state=checked]:font-semibold",
        "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
        className,
      )}
    >
      <SelectPrimitives.ItemIndicator className="shrink-0 text-secondary mt-0.5">
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
  ),
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
