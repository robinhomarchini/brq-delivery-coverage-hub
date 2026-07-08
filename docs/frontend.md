# Frontend

Stack: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn-style primitives, Recharts and lucide-react.

## Conventions

- UI copy is pt-BR.
- Code identifiers are English.
- Reuse primitives from `src/components/ui` and shared components from `src/components/shared`.
- Operational data must come from repositories/store, not hardcoded lists.
- KPI cards must use stable dimensions, compact currency formatting and no horizontal page overflow.

## UX Gate

For touched screens, check:

- scroll behavior, including iPhone/mobile width;
- header and total-card alignment;
- spacing and visual hierarchy;
- empty, loading and error states;
- keyboard navigation and labels;
- overflow/clipping in tables, filters, buttons and modals;
- consistency with the design system.

Wide tables may scroll inside their own container. The page itself should not require horizontal scroll.
