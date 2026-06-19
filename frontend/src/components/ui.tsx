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

export function Select(props: any) {
  return <select className="ui-select" {...props} />;
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
