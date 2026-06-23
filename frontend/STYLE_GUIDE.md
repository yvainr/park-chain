> **AI-generated document**

# ParkChain Frontend Style Guide

This guide defines the required UI conventions for the ParkChain frontend. Apply it to all new pages, components, and interface changes.

## Component Library

- Use [shadcn/ui](https://ui.shadcn.com/) components as the default building blocks for the interface.
- Install and compose shadcn/ui components instead of recreating common controls such as buttons, inputs, selects, dialogs, cards, tables, tabs, badges, alerts, and toasts.
- Keep generated shadcn/ui components in `src/components/ui/` and application-specific composed components in `src/components/`.
- Extend components through variants and composition. Do not edit a primitive solely for one page when a page-level wrapper or variant is sufficient.
- A custom primitive is acceptable only when shadcn/ui does not provide the required behavior. It must follow the same accessibility, styling, and API conventions.

## Icons

- Use the [Lucide icon set for shadcn](https://www.shadcn.io/icons/lucide) for all interface icons.
- Import icons from `lucide-react`; do not mix icon libraries or use Unicode symbols as UI icons.
- Use icons to support a visible label where possible. Icon-only controls must have an accessible name through `aria-label` or visually hidden text.
- Keep icon sizing consistent: `16px` in compact controls, `20px` in standard controls, and `24px` for prominent actions or status displays.
- Decorative icons must use `aria-hidden="true"`.

## Component and Icon Examples

Import shadcn/ui primitives from `src/components/ui/` and Lucide icons directly from `lucide-react`.

### Button with an icon

Use an icon to reinforce the visible action label. Let the button control icon spacing and size when supported by the installed shadcn/ui version.

```tsx
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ReserveButton() {
  return (
    <Button type="submit">
      <CalendarPlus aria-hidden="true" />
      Reserve slot
    </Button>
  );
}
```

### Card composed from shadcn/ui primitives

Build application components by composing primitives rather than reproducing their styles.

```tsx
import { Zap } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function CreditBalance({ balance }: { balance: bigint }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap aria-hidden="true" />
          ParkCredits
        </CardTitle>
        <CardDescription>Your available reservation balance</CardDescription>
      </CardHeader>
      <CardContent className="font-mono text-2xl">
        {balance.toString()}
      </CardContent>
    </Card>
  );
}
```

### Accessible form controls

Associate every input with a visible label and place validation feedback next to the relevant control.

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OperatorIdField() {
  return (
    <div className="grid gap-2">
      <Label htmlFor="operator-id">Operator ID</Label>
      <Input
        id="operator-id"
        name="operatorId"
        type="number"
        min="1"
        required
        aria-describedby="operator-id-help"
      />
      <p id="operator-id-help" className="text-sm text-muted-foreground">
        Enter the numeric ID registered on-chain.
      </p>
      <Button type="submit">Register operator</Button>
    </div>
  );
}
```

### Icon-only button

Use the shadcn/ui `Button` icon size and provide an accessible name. A tooltip may explain the action visually, but it does not replace `aria-label`.

```tsx
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function RefreshBalanceButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label="Refresh credit balance"
    >
      <RefreshCw aria-hidden="true" />
    </Button>
  );
}
```

### Transaction status

Pair status color and icons with explicit text.

```tsx
import { CircleCheck, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function TransactionStatus({ pending }: { pending: boolean }) {
  return (
    <Alert aria-live="polite">
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <CircleCheck aria-hidden="true" />
      )}
      <AlertTitle>{pending ? "Transaction pending" : "Transaction confirmed"}</AlertTitle>
      <AlertDescription>
        {pending ? "Waiting for network confirmation." : "The on-chain update succeeded."}
      </AlertDescription>
    </Alert>
  );
}
```

## Visual Language

- Prefer a restrained, functional dashboard style with clear hierarchy and high contrast.
- Use design tokens or CSS variables for colors, spacing, radii, typography, and shadows. Avoid one-off hard-coded values in components.
- Use semantic color roles such as `background`, `foreground`, `primary`, `secondary`, `muted`, `destructive`, and `border`.
- Reserve destructive styling for irreversible or high-impact actions.
- Keep spacing on a consistent 4px scale and use the standard shadcn/ui radius unless the product theme defines another value.

## Typography and Content

- Use the application sans-serif font stack defined by the global theme.
- Use sentence case for headings, buttons, labels, and navigation.
- Keep labels concise and action-oriented: for example, `Reserve slot`, `Check in`, and `Withdraw earnings`.
- Display wallet addresses, transaction hashes, and contract values in a monospaced style where it improves readability.
- Never communicate status through color alone; pair color with text and, when useful, a Lucide icon.

## Forms and Feedback

- Every form control must have a visible label, validation message, and appropriate input type.
- Disable submission while a wallet transaction is pending and show clear pending, success, and error states.
- Confirm destructive or irreversible blockchain actions in a shadcn/ui `AlertDialog`.
- Use shadcn/ui `Toast`, `Alert`, or inline form messages for feedback. Do not use browser `alert()`.
- Display credit amounts, ETH amounts, dates, and durations in human-readable formats while preserving exact values where transaction review requires them.

## Accessibility and Responsive Design

- All interactive elements must be keyboard accessible and show a visible focus state.
- Meet WCAG 2.1 AA color contrast requirements.
- Use semantic HTML before adding ARIA attributes.
- Ensure touch targets are at least 44 by 44 pixels on small screens.
- Design mobile-first. Dashboard columns should collapse into a logical single-column reading order without horizontal page scrolling.
- Respect reduced-motion preferences and avoid animation that is not useful to understanding state changes.

## Component Review Checklist

Before merging a frontend change, verify that:

- common UI is built with shadcn/ui components;
- every icon comes from Lucide through `lucide-react`;
- loading, empty, error, success, and disabled states are handled;
- forms and icon-only actions have accessible names;
- the layout works at mobile and desktop widths;
- styling uses shared tokens and variants instead of page-specific duplication.
