import type { ReactNode } from 'react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Separator } from '../components/ui/separator';

interface ShellButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'launch';
  disabled?: boolean;
  className?: string;
}

/**
 * Render one small shell action button.
 */
export function ShellButton({ label, onClick, variant = 'default', disabled = false, className = '' }: ShellButtonProps): JSX.Element {
  const mappedVariant = variant === 'launch' ? 'default' : variant === 'danger' ? 'destructive' : 'outline';
  return (
    <Button
      className={className}
      disabled={disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant={mappedVariant}
    >
      {label}
    </Button>
  );
}

interface PanelProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Render one labelled shell panel.
 */
export function Panel({ label, children, className = '' }: PanelProps): JSX.Element {
  return (
    <Card className={className}>
      <CardHeader className="px-4 pb-3 pt-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      </CardHeader>
      <Separator />
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}

interface InfoRowProps {
  label: string;
  value: string;
}

/**
 * Render one compact key-value row.
 */
export function InfoRow({ label, value }: InfoRowProps): JSX.Element {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="min-w-[78px] flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
  compact?: boolean;
}

/**
 * Render one empty shell state.
 */
export function EmptyState({ title, description, compact = false }: EmptyStateProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 text-center text-muted-foreground ${compact ? 'min-h-[180px]' : 'min-h-[420px]'}`}>
      <Badge variant="secondary" className="mb-1">empty</Badge>
      <div className="text-sm font-medium text-foreground">{title}</div>
      <div className="text-xs">{description}</div>
    </div>
  );
}
