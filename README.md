# kelex

Generate type-safe React form components from Zod schemas. Built for [TanStack Form](https://tanstack.com/form) and [Rafters](https://rafters.studio)/[shadcn/ui](https://ui.shadcn.com) components.

## Quick Start

```bash
pnpx @rafters-studio/kelex@latest generate ./src/schemas/user.ts -s userSchema
```

This reads your Zod schema and generates:

- A complete React form component with full TypeScript types
- A `primitives.tsx` file with built-in UI components (shadcn-compatible API)
- TanStack Form for state management and validation
- Client-side validation using your Zod schema

The generated primitives are pure HTML/React components styled with Tailwind that match the shadcn component API. When you're ready to use your own components, pass `--ui` to swap the import path:

```bash
pnpx @rafters-studio/kelex@latest generate ./src/schemas/user.ts -s userSchema --ui @/components/ui
```

## Requirements

- **Zod 4** - Schema definitions (`zod@^4.0.0`)
- **TanStack Form** - Form state management
- **Tailwind CSS** - Styling (used by generated primitives and form layout)

## Usage

```bash
pnpx @rafters-studio/kelex@latest generate <schema-path> [options]
```

### Options

| Option                | Description              | Default                       |
| --------------------- | ------------------------ | ----------------------------- |
| `-o, --output <path>` | Output file path         | Derived from schema path      |
| `-n, --name <name>`   | Form component name      | Derived from schema name      |
| `-s, --schema <name>` | Exported schema name     | `schema`                      |
| `--ui <path>`         | UI component import path | Generates built-in primitives |

### Examples

```bash
# Basic - generates user-form.tsx + primitives.tsx
pnpx @rafters-studio/kelex@latest generate ./src/schemas/user-schema.ts -s userSchema

# Custom output path and component name
pnpx @rafters-studio/kelex@latest generate ./src/schemas/user.ts \
  -o ./src/components/forms/profile-form.tsx \
  -n ProfileForm \
  -s userProfileSchema

# Use your own shadcn components (no primitives generated)
pnpx @rafters-studio/kelex@latest generate ./src/schemas/user.ts \
  -s userSchema \
  --ui @/components/ui
```

## Supported Types

### Scalar Types

| Zod Type                   | Component  | Notes                     |
| -------------------------- | ---------- | ------------------------- |
| `z.string()`               | Input      | `type="text"`             |
| `z.string().email()`       | Input      | `type="email"`            |
| `z.string().url()`         | Input      | `type="url"`              |
| `z.string().max(n)`        | Textarea   | When `n > 100`            |
| `z.number()`               | Input      | `type="number"`           |
| `z.number().min(a).max(b)` | Slider     | When range `b - a <= 100` |
| `z.boolean()`              | Checkbox   |                           |
| `z.enum([...])`            | RadioGroup | When `<= 4` options       |
| `z.enum([...])`            | Select     | When `> 4` options        |
| `z.date()`                 | DatePicker |                           |

### Composite Types

| Zod Type                          | Rendering                                 | Notes            |
| --------------------------------- | ----------------------------------------- | ---------------- |
| `z.object({...})`                 | Card with nested fields                   | Recursive        |
| `z.array(z.string())`             | Dynamic list with add/remove              | Simple arrays    |
| `z.array(z.object({...}))`        | Card per item with nested fields          | Array of objects |
| `z.discriminatedUnion(...)`       | Select discriminator + conditional fields |                  |
| `z.tuple([...])`                  | Card with indexed fields                  |                  |
| `z.record(z.string(), ...)`       | Key-value pair list                       |                  |
| `z.intersection(a, b)` / `.and()` | Merged into single object                 | Top-level only   |

### Modifiers

| Modifier                      | Effect                                 |
| ----------------------------- | -------------------------------------- |
| `z.optional(...)`             | Marks field as not required            |
| `z.nullable(...)`             | Sets `isNullable` on field descriptor  |
| `z.nullish(...)`              | Optional + nullable                    |
| `.brand(...)`                 | Transparent (no effect on form)        |
| `.check()` / `.superRefine()` | Validation preserved, no layout effect |
| `z.pipe()` / `.transform()`   | Uses input type for form field         |

## Example

**Input schema:**

```typescript
import { z } from "zod/v4";

export const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(150).optional(),
  role: z.enum(["admin", "user", "guest"]),
  newsletter: z.boolean(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string(),
  }),
  tags: z.array(z.string()),
});
```

**Generated output:** `user-form.tsx` + `primitives.tsx`

The form handles nested objects (Card-based grouping), arrays (dynamic add/remove), and all scalar types out of the box.

## Programmatic API

```typescript
import { generate } from "@rafters-studio/kelex";
import { userSchema } from "./schema";

const result = generate({
  schema: userSchema,
  formName: "UserForm",
  schemaImportPath: "./schema",
  schemaExportName: "userSchema",
  // omit uiImportPath to get built-in primitives
});

result.code; // Generated form component TSX
result.primitives; // Built-in UI components TSX (undefined when uiImportPath is set)
result.fields; // ["name", "email", "age", ...]
result.warnings; // Any issues encountered
```

Pass `uiImportPath` to use your own components and skip primitives generation:

```typescript
const result = generate({
  schema: userSchema,
  formName: "UserForm",
  schemaImportPath: "./schema",
  schemaExportName: "userSchema",
  uiImportPath: "@/components/ui",
});

result.primitives; // undefined
```

## Documentation

Full documentation at [rafters.studio/tools/kelex](https://rafters.studio/tools/kelex)

## License

MIT
