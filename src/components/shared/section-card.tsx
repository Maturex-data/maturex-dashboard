import type { ReactNode } from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface SectionCardProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  footer,
  children,
  className = "",
  headerClassName = "",
  contentClassName = "",
  footerClassName = "",
}: SectionCardProps) {
  return (
    <Card
      className={`flex flex-col rounded-2xl border-border/80 shadow-sm gap-0 py-0 overflow-hidden ${className}`}
    >
      {(title || description || icon || action) && (
        <CardHeader
          className={`flex-row items-center justify-between border-b border-border/70 bg-muted/30 px-5 py-3.5 ${headerClassName}`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && (
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {icon}
              </div>
            )}
            <div className="space-y-0.5 min-w-0">
              {title && (
                <CardTitle className="text-sm font-bold tracking-tight text-foreground truncate">
                  {title}
                </CardTitle>
              )}
              {description && (
                <CardDescription className="text-xs text-muted-foreground">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>

          {action && <CardAction className="shrink-0">{action}</CardAction>}
        </CardHeader>
      )}

      {children && (
        <CardContent className={`flex-1 p-5 ${contentClassName}`}>
          {children}
        </CardContent>
      )}

      {footer && (
        <CardFooter
          className={`border-t border-border/70 bg-muted/20 px-5 py-3.5 ${footerClassName}`}
        >
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}
