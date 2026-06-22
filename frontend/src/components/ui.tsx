import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function Button({ variant = "default", className = "", ...props }: any) {
  return <button className={cn("ui-button", `ui-button-${variant}`, className)} {...props} />;
}

export function Card({ className = "", ...props }: any) {
  return <section className={cn("ui-card", className)} {...props} />;
}

export function CardHeader({ className = "", ...props }: any) {
  return <div className={cn("ui-card-header", className)} {...props} />;
}

export function CardTitle({ className = "", ...props }: any) {
  return <h2 className={cn("ui-card-title", className)} {...props} />;
}

export function CardDescription({ className = "", ...props }: any) {
  return <p className={cn("ui-card-description", className)} {...props} />;
}

export function CardContent({ className = "", ...props }: any) {
  return <div className={cn("ui-card-content", className)} {...props} />;
}

export function Input(props: any) {
  return <input className="ui-input" {...props} />;
}

export function NativeSelect(props: any) {
  return <select className="ui-select" {...props} />;
}

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({ className = "", children, ...props }: any) {
  return (
    <SelectPrimitive.Trigger className={cn("ui-select-trigger", className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown aria-hidden="true" size={16} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({ className = "", children, position = "popper", ...props }: any) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn("ui-select-content", position === "popper" && "ui-select-content-popper", className)}
        position={position}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="ui-select-scroll-button">
          <ChevronUp aria-hidden="true" size={16} />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="ui-select-viewport">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="ui-select-scroll-button">
          <ChevronDown aria-hidden="true" size={16} />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({ className = "", children, ...props }: any) {
  return (
    <SelectPrimitive.Item className={cn("ui-select-item", className)} {...props}>
    <span className="ui-select-item-indicator">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden="true" size={16} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function Table({ className = "", ...props }: any) {
  return (
    <div className="ui-table-container">
      <table className={cn("ui-table", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className = "", ...props }: any) {
  return <thead className={cn("ui-table-header", className)} {...props} />;
}

export function TableBody({ className = "", ...props }: any) {
  return <tbody className={cn("ui-table-body", className)} {...props} />;
}

export function TableRow({ className = "", ...props }: any) {
  return <tr className={cn("ui-table-row", className)} {...props} />;
}

export function TableHead({ className = "", ...props }: any) {
  return <th className={cn("ui-table-head", className)} {...props} />;
}

export function TableCell({ className = "", ...props }: any) {
  return <td className={cn("ui-table-cell", className)} {...props} />;
}

export function Checkbox(props: any) {
  return <input className="ui-checkbox" type="checkbox" {...props} />;
}

export function Label({ className = "", ...props }: any) {
  return <label className={cn("ui-label", className)} {...props} />;
}

export function Badge({ variant = "secondary", className = "", ...props }: any) {
  return <span className={cn("ui-badge", `ui-badge-${variant}`, className)} {...props} />;
}
