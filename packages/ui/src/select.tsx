"use client";

import * as React from "react";
import { Select as BaseSelect } from "@base-ui/react/select";
import { useDialogLayerContainer } from "./dialog";
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
  items?:
    | Record<string, React.ReactNode>
    | ReadonlyArray<{ label: React.ReactNode; value: Value }>;
  modal?: boolean;
}

function SelectImpl<Value = string>({
  value,
  defaultValue,
  onValueChange,
  placeholder,
  disabled,
  required,
  readOnly,
  name,
  id,
  children,
  className,
  triggerClassName,
  popupClassName,
  renderValue,
  align = "start",
  items,
  modal = false,
}: SelectProps<Value>) {
  const portalContainer = useDialogLayerContainer();

  return (
    <BaseSelect.Root<Value>
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => {
        if (v !== null && onValueChange) onValueChange(v);
      }}
      disabled={disabled}
      required={required}
      readOnly={readOnly}
      name={name}
      id={id}
      items={items as never}
      modal={modal}
    >
      <BaseSelect.Trigger
        className={cn(
          "w-full flex items-center justify-between gap-3 bg-surface-container-low border border-transparent rounded-xl px-4 py-3 text-sm text-left text-on-surface font-body transition-colors",
          "hover:bg-surface-container focus:bg-surface-container-high focus:border-secondary/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40",
          "data-[popup-open]:bg-surface-container-high",
          "disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer",
          triggerClassName,
          className
        )}
      >
        <BaseSelect.Value
          className="truncate data-[placeholder]:text-outline-variant"
          placeholder={placeholder}
        >
          {renderValue
            ? (v: Value) =>
                v === null || v === undefined ? placeholder : renderValue(v)
            : undefined}
        </BaseSelect.Value>
        <BaseSelect.Icon className="shrink-0 text-on-surface-variant">
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
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal container={portalContainer ?? undefined}>
        <BaseSelect.Positioner
          sideOffset={6}
          align={align}
          // pointer-events-auto: when this select is rendered inside a Radix
          // Dialog, Radix sets `pointer-events: none` on <body> (see
          // @radix-ui/react-dismissable-layer). The Base UI portal is a body
          // child, so without this override the popup renders but all hover
          // and click interactions are blocked.
          className="z-[60] outline-none pointer-events-auto"
        >
          <BaseSelect.Popup
            className={cn(
              "pointer-events-auto min-w-[var(--anchor-width)] bg-surface-container-lowest rounded-2xl shadow-xl border border-outline-variant/20 p-1.5 font-body",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[ending-style]:scale-[0.98]",
              "transition-[opacity,transform] duration-150 origin-[var(--transform-origin)]",
              popupClassName
            )}
          >
            <BaseSelect.List className="max-h-[min(24rem,var(--available-height))] overflow-y-auto">
              {children}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export const Select = SelectImpl as <Value = string>(
  props: SelectProps<Value>
) => React.JSX.Element;

export interface SelectItemProps {
  value: unknown;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, disabled, children, className, label }, ref) => (
    <BaseSelect.Item
      ref={ref as React.Ref<HTMLElement>}
      value={value}
      disabled={disabled}
      label={label}
      className={cn(
        "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-on-surface cursor-pointer outline-none select-none",
        "data-[highlighted]:bg-surface-container-high data-[highlighted]:text-primary",
        "data-[selected]:bg-secondary/10 data-[selected]:text-secondary data-[selected]:font-semibold",
        "data-[disabled]:opacity-40 data-[disabled]:cursor-not-allowed",
        className
      )}
    >
      <BaseSelect.ItemIndicator className="shrink-0 text-secondary">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.25}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </BaseSelect.ItemIndicator>
      <BaseSelect.ItemText className="flex-1 truncate">
        {children}
      </BaseSelect.ItemText>
    </BaseSelect.Item>
  )
);
SelectItem.displayName = "SelectItem";

export const SelectGroup = BaseSelect.Group;
export const SelectGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <BaseSelect.GroupLabel
    ref={ref}
    className={cn(
      "px-3 pt-3 pb-1.5 text-[10px] font-headline font-bold uppercase tracking-widest text-on-surface-variant",
      className
    )}
    {...props}
  />
));
SelectGroupLabel.displayName = "SelectGroupLabel";
