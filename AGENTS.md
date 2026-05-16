# ANGULAR 21 + TYPESCRIPT KNOWLEDGE BASE

**Stack:** Angular 21.2+ (latest stable), TypeScript 5.9+, Node.js ≥22.22.0, Vitest, pnpm
**Style:** Standalone-first, signal-driven, zoneless, strict TypeScript.

---

## PROJECT STRUCTURE

### DDD-Aligned (Primary)

Code is organized by **business domain / bounded context**, not by technical layer. Each domain is an encapsulated slice:

```
src/
├── app/
│   ├── core/                    # App shell, root providers, preload
│   ├── layouts/                 # Shell/page layout components
│   ├── domains/                 # Bounded contexts — one per business domain
│   │   ├── orders/
│   │   │   ├── data/            # Repository implementations, DTOs, API mappers
│   │   │   ├── domain/          # Entities, value objects, domain events, aggregate roots
│   │   │   ├── application/     # Use cases / application services (injectable facades)
│   │   │   ├── ui/              # Presentation components (smart + dumb)
│   │   │   ├── pages/           # Route-level page components (lazy-loaded)
│   │   │   └── routes.ts        # Child routes for this domain
│   │   ├── products/
│   │   │   └── ...              # Same sub-structure
│   │   ├── billing/
│   │   │   └── ...
│   │   └── user/
│   │       └── ...
│   └── shared/                  # Cross-domain: pure UI primitives, utilities
│       ├── ui/                  # Buttons, inputs, cards (no business logic)
│       └── lib/                 # Pure helpers, types, math, constants
├── assets/
├── environments/
└── styles/
```

### Layer Dependency Rules

```
[ pages ] → [ ui ] → [ application ] → [ domain ]
                                          ↓
                                    [ data (infrastructure) ] → [ shared / core ]
```

- **Dependencies flow downward only.** A domain never imports from another domain.
- **`application`** layer orchestrates use cases; it depends on `domain` + `data`.
- **`domain`** layer has zero Angular imports — pure TypeScript, no framework coupling.
- **`data`** layer implements repository interfaces from `domain`; maps DTOs ↔ domain models.
- **`ui`** only talks to `application` (facades), never directly to `data` or another domain's `ui`.
- **`shared`** is business-agnostic (buttons, pipes, utils). No domain may leak into shared.

---

## WHERE TO LOOK

| Task | Pattern |
|------|---------|
| State/Reactivity | Signals (`signal`, `computed`, `effect`) |
| HTTP | `HttpClient` (auto-provided in v21 — no `provideHttpClient()` needed) |
| Forms | **New:** Signal Forms (`@angular/forms/signals`), **Legacy:** Reactive Forms |
| Routing | Lazy standalone routes, `toSignal(ActivatedRoute.params)` |
| Auth | Route guards as functions (not classes), signal-based auth state |
| UI/Accessibility | Angular Aria (headless, dev preview) — or Angular Material |
| Testing | Vitest (default), Playwright for e2e |
| Build | `@angular/build` with esbuild/Vite — no Karma, no zone.js polyfills |
| Domain layer | Pure TypeScript in `domains/*/domain/` — entities, VOs, aggregates, domain events |
| Application layer | Injectable facades in `domains/*/application/` — use cases, orchestration |
| Data layer | Repository implementations in `domains/*/data/` — API calls, DTO mapping |
| Cross-domain | `shared/ui/` (primitives) and `shared/lib/` (pure utils) — no business logic |

---

## ANGULAR 21 CORE CONVENTIONS

### Standalone All the Way
- **No NgModules.** Components, directives, and pipes are always `standalone: true` (implicit in v21).
- Use `bootstrapApplication` + `provideRouter` + `provideZoneChangeDetection` only if opting into zone.js.
- Lazy routes via `loadComponent` / `loadChildren` with standalone components.

### Signals > RxJS for UI State
- `signal()` for writable state, `computed()` for derived, `effect()` for side effects.
- Use `toSignal()` to bridge RxJS → signals. Avoid subscribing in components.
- **Anti-pattern:** `BehaviorSubject` + `async` pipe for simple UI state. Use signals.
- Use `linkedSignal()` for state that resets when its source changes.
- Use `ResourceSnapshot` + `resourceFromSnapshots()` for async data (v21.2+).

### Zoneless Change Detection (Default)
- Zone.js is **not included** in new projects. No polyfill needed.
- Change detection triggers: signal writes, template events (`(click)`), input changes, `markForCheck()`.
- `ChangeDetectionStrategy.OnPush` is now the **default** (v21.1+). Use `ChangeDetectionStrategy.Eager` to opt out.
- **Watch:** Third-party libs assuming Zone.js. `setTimeout`/`addEventListener` outside Angular → must call `markForCheck()` or wrap in signals.
- `fakeAsync`/`tick()` not available in zoneless — use Vitest fake timers (`vi.useFakeTimers()`).

### New Template Syntax (Always)
- `@if (cond) { ... } @else { ... }` — never `*ngIf`.
- `@for (item of items; track item.id) { ... } @empty { ... }` — never `*ngFor`.
- `@switch (val) { @case 'a' { ... } @default { ... } }` — never `*ngSwitch`.
- `@let name = expr;` for local template variables (v21+).
- `@defer on viewport;` for lazy-loaded UI blocks (stable, supports IntersectionObserver options).
- Arrow functions in templates: `(items.map(i => i.name))` (v21.2+).
- Exhaustive `@switch` type-checking: `@default never;` (v21.2+).

### Signal Forms (Experimental — Prefer with Caution)
- Import from `@angular/forms/signals`.
- `FormGroup`, `FormControl`, `FormArray` are replaced with signal-based equivalents.
- Use `formField` directive (renamed from `field` in v21.1), `FormRoot` for template binding (v21.2+).
- `transformedValue` utility for custom controls with `parse`/`format` (v21.2+).
- CSS class config via `provideSignalFormsConfig({ classes: {...} })`.
- **Fallback:** Reactive Forms still available if Signal Forms are too unstable.

### Angular Aria (Developer Preview)
- Headless, accessible components: accordion, combobox, tabs, menu, dialog, etc.
- No visual opinions — bring your own styles. ARIA, keyboard nav, focus management included.
- Preferred over building custom accessible components from scratch.

### Vitest (Default — Never Karma/Jasmine)
- Tests are zoneless by default. No `fakeAsync`/`tick()`.
- Use `vi.useFakeTimers()` for timer control, `vi.runAllTimersAsync()` for debounce.
- Component harnesses via `@angular/cdk/testing` + `TestbedHarnessEnvironment`.
- Migration from Karma: `ng generate @angular/core:karma-to-vitest`.
- Config in `vite.config.ts` (or inlined in `angular.json`).

### HttpClient Auto-Provided (v21)
- Injectable in any service/component without `provideHttpClient()`.
- Interceptors: use `withInterceptors()` (functional) not class-based.
- Request/response progress: `reportUploadProgress` / `reportDownloadProgress` options.

---

## DOMAIN-DRIVEN DESIGN

### Strategic Design: Bounded Contexts

Each `domains/*/` folder is a **bounded context** — an isolated subdomain with its own ubiquitous language. A "User" in `domains/orders/` is **not** the same entity as "User" in `domains/billing/`. Each context owns its model entirely.

**Rules:**
- One bounded context per business subdomain (orders, billing, products, user).
- Contexts communicate only through the `application` layer (facades), never via direct imports.
- Each context publishes a minimal public API — everything else is `private` via barrel `index.ts` exports.
- No domain imports another domain's `domain/`, `data/`, or `ui/` layer directly.

### Tactical Patterns per Context

```
domains/{context}/
├── domain/          # Pure TypeScript — zero Angular dependencies
├── data/            # Infrastructure — Angular services, HTTP, DTO mapping
├── application/     # Orchestration — Angular injectable facades
├── ui/              # Components bound to application facades
└── pages/           # Route-level lazy components
```

#### `domain/` — Pure TypeScript (no Angular)

Contains **entities**, **value objects**, **aggregate roots**, and **domain events**. Zero framework imports. This is the heart of the business logic.

```typescript
// Entity
export class Order {
  private constructor(
    public readonly id: OrderId,
    public readonly items: LineItem[],
    private _status: OrderStatus,
  ) {}

  static create(items: LineItem[]): Result<Order, ValidationError> {
    if (items.length === 0) return { ok: false, error: { kind: 'empty_order' } };
    return { ok: true, value: new Order(createOrderId(), items, 'pending') };
  }

  get status(): OrderStatus { return this._status; }

  submit(): Result<void, DomainError> {
    if (this._status !== 'pending') return { ok: false, error: { kind: 'invalid_state' } };
    this._status = 'submitted';
    return { ok: true, value: undefined };
  }
}

// Value Object
export class LineItem {
  constructor(
    public readonly productId: ProductId,
    public readonly quantity: number,
    public readonly unitPrice: Money,
  ) {}
}

// Aggregate Root marker
export interface AggregateRoot {
  readonly id: string;
}

// Domain Event
export interface DomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly type: string;
}
```

#### `data/` — Infrastructure (Angular Services)

Implements **repository interfaces** from `domain/`. Handles API calls, DTO mapping, caching. Never exposes framework internals to the domain.

```typescript
// Domain interface (in domain/):
export interface OrderRepository {
  findById(id: OrderId): Promise<Order | null>;
  save(order: Order): Promise<void>;
}

// Infrastructure implementation (in data/):
@Injectable({ providedIn: 'root' })
export class OrderRepositoryImpl implements OrderRepository {
  private readonly http = inject(HttpClient);

  async findById(id: OrderId): Promise<Order | null> {
    const dto = await firstValueFrom(this.http.get<OrderDto>(`/orders/${id}`));
    return dto ? mapToDomain(dto) : null;
  }

  async save(order: Order): Promise<void> {
    const dto = mapToDto(order);
    await firstValueFrom(this.http.post('/orders', dto));
  }
}
```

#### `application/` — Use Cases (Injectable Facades)

Orchestrates domain objects and infrastructure. Components talk **only** to facades, never to `data/` or `domain/` directly.

```typescript
@Injectable({ providedIn: 'root' })
export class OrderFacade {
  private readonly repo = inject(OrderRepository);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(false);

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    try {
      const orders = await this.repo.findAll();
      this.orders.set(orders);
    } finally {
      this.loading.set(false);
    }
  }

  async submitOrder(id: OrderId): Promise<Result<void, DomainError>> {
    const order = await this.repo.findById(id);
    if (!order) return { ok: false, error: { kind: 'not_found' } };
    const result = order.submit();
    if (result.ok) await this.repo.save(order);
    return result;
  }
}
```

#### `ui/` — Presentation Components

Smart components consume facades; dumb components get `@Input()` data. No direct API calls, no domain imports.

```typescript
@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [OrderCardComponent],
  template: `
    @if (loading()) { <spinner /> }
    @for (order of orders(); track order.id) {
      <app-order-card [order]="order" />
    }
  `,
})
export class OrderListComponent {
  private readonly facade = inject(OrderFacade);
  readonly orders = this.facade.orders;
  readonly loading = this.facade.loading;

  constructor() {
    this.facade.loadOrders();
  }
}
```

### Dependency Flow Enforcement

Enforce boundaries via **barrel exports** and lint rules:

```
domains/orders/
├── domain/
│   └── index.ts        # Export: entities, VOs, repos interfaces only
├── data/
│   └── index.ts        # Export: repository implementations only
├── application/
│   └── index.ts        # Export: facades only
├── ui/
│   └── index.ts        # Export: components only
└── pages/
    └── index.ts        # Export: page components only
```

**Import rules (enforced by convention):**

| Layer | Can Import From |
|-------|----------------|
| `pages/` | Same domain `ui/` + `application/` |
| `ui/` | Same domain `application/` + `shared/ui/` + `shared/lib/` |
| `application/` | Same domain `domain/` + `data/` + `shared/lib/` |
| `data/` | Same domain `domain/` + `shared/lib/` + `core/` |
| `domain/` | `shared/lib/` only (pure utilities) |

**Never:**
- `ui/` → `data/` directly (bypasses application layer)
- `domain/` → any Angular framework import
- Any cross-domain import (e.g., `orders/` → `products/`)
- Circular dependencies between layers

### Shared Cross-Domain Code

Only these live outside domains:

```
shared/
├── ui/         # Primitives: buttons, inputs, cards, tables — no business logic
└── lib/        # Pure utils: date formatting, math, constants, brand types

core/           # Singleton: auth state, HTTP interceptors, global guards
```

- `shared/ui/` components accept `@Input()` data and emit `@Output()` events — no facades.
- `shared/lib/` is pure TypeScript — no Angular imports, no side effects.
- `core/` handles cross-cutting concerns (auth, logging, global error handling).

---

## TYPESCRIPT STRICT MODE

### tsconfig.json Baseline
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noUncheckedSideEffectImports": true,
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true,
    "erasableSyntaxOnly": true
  }
}
```

### Non-Negotiable Rules
- **`strict: true`** — enables all: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictPropertyInitialization`, `strictBindCallApply`, `useUnknownInCatchVariables`.
- **`noUncheckedIndexedAccess`** — array/dict access returns `T | undefined`. Always guard.
- **`verbatimModuleSyntax`** — use `import type { Foo }` for type-only imports. No `import { Foo }` if Foo is only a type.
- **`erasableSyntaxOnly`** — no enums (use `const` objects + `as const`), no `namespace`, no `parameter properties` (`constructor(public x: number)` is forbidden).
- **`exactOptionalPropertyTypes`** — `prop?: string` means `prop` must be `string | undefined`, not absent.

---

## TYPESCRIPT PATTERNS

### Discriminated Unions (Preferred for Domain Models)
```typescript
type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Exhaustive check:
function assertNever(state: never): never { throw new Error('unreachable'); }
```

### Branded Types for Primitive Safety
```typescript
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };
const createUserId = (id: string) => id as UserId;
```

### `satisfies` Over Type Annotation
```typescript
const config = {
  api: 'https://...',
  retries: 3,
} satisfies Record<string, string | number>;
// config.api is `string`, not `string | number`
```

### `Result` Pattern for Error Handling
```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

function parseJson(input: string): Result<unknown> {
  try { return { ok: true, value: JSON.parse(input) }; }
  catch (e) { return { ok: false, error: e as Error }; }
}
```

### `unknown` Over `any`
- Catch variables are `unknown` (enforced by `useUnknownInCatchVariables`).
- API responses → validate schema, then cast with branded type. Never `as any`.

### Prefer `const` Assertions
```typescript
export const ROLES = ['admin', 'user', 'guest'] as const;
export type Role = (typeof ROLES)[number];
```

---

## ANTI-PATTERNS (FORBIDDEN)

| Pattern | Instead |
|---------|---------|
| `*ngIf`, `*ngFor`, `*ngSwitch` | `@if`, `@for`, `@switch` |
| `async` pipe for component-local state | `signal()` + computed |
| `BehaviorSubject` + `takeUntil`/`unsubscribe` in components | `toSignal()` / `effect()` |
| `as any` / `@ts-ignore` / `@ts-expect-error` | Proper type narrowing or branded types |
| Class-based interceptors | Functional interceptors (`withInterceptors`) |
| `NgModules` | Standalone components |
| Karma/Jasmine | Vitest |
| `fakeAsync`/`tick()` in zoneless tests | `vi.useFakeTimers()` / `vi.runAllTimersAsync()` |
| zone.js polyfill in new projects | Zoneless (default) |
| `constructor(private http: HttpClient)` without `readonly` | `private readonly http` |
| `enum` keyword | `const` objects + `as const` + type union |
| `namespace` / `module` (ambient) | ES module exports |
| `import { Type } from './module'` for type-only | `import type { Type } from './module'` |
| Mutable `@Input()` without `readonly` | `@Input() readonly value: T` or signal inputs |
| Empty `catch(e) {}` | Handle or rethrow. At minimum log. |
| `ui/` calling API services directly | Route through `application/` facade layer |
| `domain/` importing Angular framework | Pure TypeScript only — zero framework deps |
| Cross-domain import (`orders/` → `products/`) | Communicate via facades or shared events |
| One giant `shared/` with business logic | Business logic stays in its bounded context |
| Leaking DTO types to `ui/` or `domain/` | Map DTOs → domain models in `data/` layer |

---

## COMMANDS

```bash
pnpm install              # Install dependencies
pnpm ng serve             # Dev server (Vite + esbuild, HMR)
pnpm ng build             # Production build
pnpm ng test              # Vitest (zoneless, fast)
pnpm ng e2e               # Playwright e2e
pnpm ng generate          # Angular CLI (component/service/etc.)
pnpm ng mcp               # Angular MCP server for AI tooling
```

---

## PERFORMANCE & ARCHITECTURE

- **`@defer`** for below-fold, heavy, or non-critical UI. Use `on viewport`, `on idle`, `on interaction`.
- **`track`** in `@for` — always provide a unique key. Never omit.
- **Lazy routes** over eager-loaded feature modules. Every route should lazy load.
- **SSR** via `provideServerRendering` + hydration. Enabled by default for new Angular 21 apps.
- **Incremental hydration** with `@defer`-powered water shedding (stable in v21).
- **`OnPush`** (now default) — no unnecessary CD cycles. Test with signal-based inputs.
- **Bundle size:** zoneless = ~30KB saved from no zone.js polyfill.

---

## UPGRADE NOTES (v20 → v21)

1. Remove `zone.js` from `angular.json` polyfills if zoneless.
2. Replace `*ngIf`/`*ngFor` → `@if`/`@for` (if not already).
3. Set `ChangeDetectionStrategy.OnPush` (or opt out with `Eager`).
4. Migrate Karma → Vitest: `ng generate @angular/core:karma-to-vitest`.
5. Remove manual `HttpClientModule` imports (auto-provided).
6. Minimum Node.js v22.22.0, TypeScript ≥5.9.

---

## CONSULT GUIDANCE

When implementing Angular code in this project:
- **Always** use standalone components (never NgModules).
- **Always** use new control flow (`@if`, `@for`, `@switch`, `@let`, `@defer`).
- **Prefer** signals for state, RxJS only for event streams (routing, WebSocket, debounced search).
- **Prefer** functional guards/interceptors over class-based.
- **Never** suppress types. Use proper narrowing, discriminated unions, or branded types.
- **Tests** are zoneless Vitest — no `fakeAsync`. Use signals + `vi.useFakeTimers()`.
- **Forms:** Start with Signal Forms (experimental). Fall back to Reactive Forms if interop is needed.
