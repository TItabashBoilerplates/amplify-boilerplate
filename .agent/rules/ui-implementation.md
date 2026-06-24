# UI Design System and Implementation Guidelines

This project uses a unified design system with **shadcn/ui + TailwindCSS 4**.

## shadcn/ui Components

- **Foundation**: Radix UI primitives (accessibility compliant)
- **Styling**: TailwindCSS 4 with CSS variables
- **Customization**: Managed in `frontend/apps/web/components.json`
- **Shared Components**: Located in `frontend/packages/ui/components/`

## UI Implementation Guidelines

### 1. Component Configuration Reference

- `frontend/apps/web/components.json` - shadcn/ui configuration file
- `frontend/apps/web/app/globals.css` - TailwindCSS CSS variable definitions
- `frontend/packages/ui/components/` - Shared components

### 2. Available Components

```typescript
// Import shadcn/ui components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Usage example
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <Button variant="default">Button</Button>
  </CardContent>
</Card>;
```

### 3. Adding New Components

```bash
cd frontend
bun run ui:add <component-name>
# Example: bun run ui:add table select checkbox
```

### 4. Using TailwindCSS CSS Variables

```typescript
// ✅ Good: Use CSS variables
<Card className="border-border bg-background">
  <h2 className="text-foreground">Title</h2>
  <p className="text-muted-foreground">Description</p>
</Card>

// ❌ Bad: Hardcoded colors
<Card className="border-gray-200 bg-white">
  <h2 className="text-black">Title</h2>
  <p className="text-gray-600">Description</p>
</Card>
```

### 5. Color Usage Rules

- Hardcoded colors (`#ffffff`, `rgb(255,255,255)`, `gray-500`, etc.) are prohibited
- Always use CSS variables (`text-foreground`, `bg-background`, `border-border`, `text-primary`, etc.)
- If new colors are needed, add to CSS variables in `app/globals.css`

### 6. Color Management

- Use TailwindCSS CSS variables (`--background`, `--foreground`, `--primary`, etc.)
- Theme file: `frontend/apps/web/app/globals.css`
- Dark mode support: Automatic switching with `dark:` prefix

### 7. Accessibility Compliance

- Leverage Radix UI accessibility features
- ARIA attributes are automatically applied
- Keyboard navigation support
- Follow contrast ratio standards
- Do not rely solely on color for information
- Screen reader support

### 8. Responsive Design

- Use TailwindCSS responsive utilities
- `sm:`, `md:`, `lg:`, `xl:` prefixes

## Summary

This implementation enables a unified, accessible, and maintainable UI system.
