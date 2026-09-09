import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-sm font-bold tracking-wide transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm",
        variant === "primary" && "bg-gold text-gold-ink hover:bg-[#F0B94F]",
        variant === "secondary" && "bg-transparent text-ink border border-border-strong hover:border-gold",
        variant === "ghost" && "text-ink-soft hover:text-ink hover:bg-white/5",
        variant === "danger" && "bg-transparent text-rust border border-rust hover:bg-rust-soft",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-sm border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-ring/25",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-gold", className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-sm border border-border bg-surface", className)} {...props} />;
}

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "primary" | "outline" | "danger" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        variant === "default" && "bg-surface-2 text-ink-soft",
        variant === "primary" && "bg-gold text-gold-ink",
        variant === "outline" && "border border-border-strong text-cream-soft",
        variant === "danger" && "bg-rust text-cream",
        variant === "muted" && "bg-sage-soft text-sage",
        className,
      )}
      {...props}
    />
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-2 text-sm text-rust">{children}</p>;
}

export function Avatar({
  name,
  size = 40,
  tone = "gold",
}: {
  name: string;
  size?: number;
  tone?: "gold" | "rust" | "wood" | "sage";
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const bg = { gold: "bg-gold text-gold-ink", rust: "bg-rust text-cream", wood: "bg-wood text-cream", sage: "bg-sage text-gold-ink" }[
    tone
  ];
  return (
    <div
      className={cn("flex flex-none rotate-45 items-center justify-center rounded-sm", bg)}
      style={{ width: size, height: size }}
    >
      <span className="-rotate-45 font-display" style={{ fontSize: size * 0.38 }}>
        {initials}
      </span>
    </div>
  );
}

export function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <Card className="p-4">
      <div className="font-display text-2xl text-gold">{value}</div>
      <div className="mt-1 text-xs text-ink-soft">{label}</div>
    </Card>
  );
}

export function LevelBar({ progress }: { progress: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const seg = Math.min(1, Math.max(0, progress * 5 - i));
        return (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-gold" style={{ width: `${seg * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-gold" aria-label={`${rating} sur 5`}>
      {"★".repeat(Math.round(rating))}
      <span className="text-border-strong">{"★".repeat(5 - Math.round(rating))}</span>
    </span>
  );
}
