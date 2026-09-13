# OpenAPI Code Generation Implementation Plan

## Overview

This document outlines the comprehensive plan to replace manually-maintained TypeScript types and client methods with OpenAPI-generated code for the Etsy API v3 client.

## Etsy OpenAPI Specification

- **Documentation**: https://developers.etsy.com/documentation/reference/
- **OpenAPI Spec URL**: https://www.etsy.com/openapi/generated/oas/3.0.0.json

The spec will be downloaded and stored locally at `spec/etsy-openapi.json` for version control and reproducibility.

## Goals

1. **Deterministic Generation**: Use the Etsy OpenAPI spec as the single source of truth
2. **Full Type Coverage**: Generate all TypeScript interfaces from `components.schemas`
3. **Complete Client Methods**: Generate all API methods from `paths`
4. **Validation Schemas**: Generate validation rules from OpenAPI constraints
5. **Error Types**: Generate typed error classes from error response schemas
6. **Preserve Infrastructure**: Keep existing rate limiting, caching, token management, retry logic

## Current State Analysis

### Files to Replace (Generated)

| File | Lines | Description |
|------|-------|-------------|
| `src/types.ts` | 1,563 | ~60+ manually maintained interfaces |
| `src/client.ts` | 1,463 | All API method implementations |

### Infrastructure to Preserve (Not Generated)

| File | Purpose |
|------|---------|
| `src/rate-limiting.ts` | Header-based rate limiting with exponential backoff |
| `src/auth/token-manager.ts` | OAuth token refresh with rotation support |
| `src/bulk-operations.ts` | Concurrent operation management |
| `src/pagination.ts` | Async iterator-based pagination |
| `src/retry.ts` | Exponential backoff retry logic |
| `src/advanced-caching.ts` | LRU/LFU caching strategies |
| `src/query-builder.ts` | Fluent query API |
| `src/plugins.ts` | Plugin system |
| `src/webhooks.ts` | Webhook signature verification |
| `src/validation.ts` | Validator class (keep, extend with generated schemas) |

---

## Target File Structure

```
etsy-v3-api-client/
├── spec/
│   └── etsy-openapi.json              # Version-controlled Etsy OpenAPI spec
│
├── scripts/
│   └── generate/
│       ├── index.mjs                   # CLI entry point
│       ├── config.mjs                  # Generator configuration
│       ├── parser.mjs                  # OpenAPI spec parser
│       ├── generators/
│       │   ├── types.mjs               # Type/interface generator
│       │   ├── client.mjs              # Client method generator
│       │   ├── validation.mjs          # Validation schema generator
│       │   └── errors.mjs              # Error types generator
│       └── utils/
│           ├── naming.mjs              # camelCase/PascalCase utilities
│           ├── typescript.mjs          # TS code formatting helpers
│           └── jsdoc.mjs               # JSDoc comment generation
│
├── src/
│   ├── generated/                      # Generated code (committed to repo)
│   │   ├── types.ts                    # All interfaces from components.schemas
│   │   ├── client-methods.ts           # Abstract base class with all API methods
│   │   ├── validation-schemas.ts       # Validation schemas from constraints
│   │   ├── errors.ts                   # Typed error classes
│   │   └── index.ts                    # Re-exports all generated code
│   │
│   ├── client.ts                       # Main EtsyClient (extends generated + infrastructure)
│   ├── types.ts                        # Re-exports generated + config types
│   └── index.ts                        # Public API exports
```

---

## OpenAPI Extraction Strategy

### What We Extract from OpenAPI

| OpenAPI Location | Generates |
|------------------|-----------|
| `paths[path][method]` | Client methods |
| `paths[*][*].operationId` | Method names |
| `paths[*][*].parameters` | Method parameters (path, query, header) |
| `paths[*][*].requestBody` | Request body types |
| `paths[*][*].responses` | Return types and error types |
| `components.schemas` | TypeScript interfaces |
| `components.securitySchemes` | Auth flow documentation |
| `tags` | Method grouping/organization |
| `x-*` extensions | Etsy-specific metadata (rate limits, etc.) |
| `deprecated` | Deprecation markers |

### Type Mapping Rules

| OpenAPI Type | TypeScript Type |
|--------------|-----------------|
| `string` | `string` |
| `integer` | `number` |
| `number` | `number` |
| `boolean` | `boolean` |
| `array` + `items` | `T[]` |
| `object` + `properties` | `interface { ... }` |
| `$ref: "#/components/schemas/X"` | `X` (referenced type) |
| `enum: ['a', 'b', 'c']` | `'a' \| 'b' \| 'c'` |
| `oneOf: [...]` | `A \| B \| C` (union) |
| `allOf: [...]` | `A & B & C` (intersection) |
| `nullable: true` | `T \| null` |

### Validation Constraint Mapping

| OpenAPI Constraint | Validation Rule |
|--------------------|-----------------|
| `required: ['field']` | `field('x').required()` |
| `minLength: n` | `field('x').string({ min: n })` |
| `maxLength: n` | `field('x').string({ max: n })` |
| `minimum: n` | `field('x').number({ min: n })` |
| `maximum: n` | `field('x').number({ max: n })` |
| `enum: [...]` | `field('x').enum([...])` |
| `pattern: 'regex'` | `field('x').string({ pattern: /regex/ })` |
| `minItems: n` | Array length validation |
| `maxItems: n` | Array length validation |

---

## Implementation Phases

### Phase 1: Foundation Setup

**Step 1: Fetch and Store OpenAPI Spec**
```bash
# Fetch the official Etsy OpenAPI spec
# Documentation: https://developers.etsy.com/documentation/reference/
curl -o spec/etsy-openapi.json https://www.etsy.com/openapi/generated/oas/3.0.0.json
```

**Step 2: Create Generator Skeleton**

```javascript
// scripts/generate/index.mjs
import { parseOpenApiSpec } from './parser.mjs';
import { generateTypes } from './generators/types.mjs';
import { generateClientMethods } from './generators/client.mjs';
import { generateValidationSchemas } from './generators/validation.mjs';
import { generateErrors } from './generators/errors.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const typesOnly = args.includes('--types-only');
const clientOnly = args.includes('--client-only');

async function main() {
  const spec = await parseOpenApiSpec('spec/etsy-openapi.json');

  if (!clientOnly) {
    const types = generateTypes(spec.schemas);
    if (!dryRun) writeFile('src/generated/types.ts', types);
  }

  if (!typesOnly) {
    const methods = generateClientMethods(spec.paths);
    if (!dryRun) writeFile('src/generated/client-methods.ts', methods);
  }

  // ... validation and errors
}
```

**Step 3: Create Output Directory**
```bash
mkdir -p src/generated
```

---

### Phase 2: Type Generation

**Generator: `scripts/generate/generators/types.mjs`**

```javascript
export function generateTypes(schemas) {
  const output = [
    '/**',
    ' * Etsy API v3 Types',
    ' * Generated from OpenAPI spec - DO NOT EDIT MANUALLY',
    ' * @generated',
    ' */',
    '',
  ];

  for (const [name, schema] of Object.entries(schemas)) {
    output.push(generateInterface(name, schema));
    output.push('');
  }

  return output.join('\n');
}

function generateInterface(name, schema) {
  const lines = [];

  // JSDoc from description
  if (schema.description) {
    lines.push(`/**`);
    lines.push(` * ${schema.description}`);
    lines.push(` */`);
  }

  lines.push(`export interface ${name} {`);

  for (const [propName, propSchema] of Object.entries(schema.properties || {})) {
    const isRequired = (schema.required || []).includes(propName);
    const tsType = mapToTypeScript(propSchema);
    const optional = isRequired ? '' : '?';

    if (propSchema.description) {
      lines.push(`  /** ${propSchema.description} */`);
    }
    lines.push(`  ${propName}${optional}: ${tsType};`);
  }

  lines.push(`}`);
  return lines.join('\n');
}
```

**Handle Etsy-Specific Patterns:**

```typescript
// Money object pattern detection
// OpenAPI: { amount: integer, divisor: integer, currency_code: string }
// Generate shared interface:
export interface EtsyMoney {
  amount: number;
  divisor: number;
  currency_code: string;
}

// Helper (hand-maintained in utils)
export function formatMoney(money: EtsyMoney): number {
  return money.amount / money.divisor;
}
```

---

### Phase 3: Client Method Generation

**Generator: `scripts/generate/generators/client.mjs`**

```javascript
export function generateClientMethods(paths) {
  const output = [
    '/**',
    ' * Etsy API v3 Client Methods',
    ' * Generated from OpenAPI spec - DO NOT EDIT MANUALLY',
    ' * @generated',
    ' */',
    '',
    'import type { ... } from "./types";',
    '',
    'export abstract class EtsyClientGeneratedMethods {',
    '  protected abstract makeRequest<T>(',
    '    endpoint: string,',
    '    options?: RequestInit,',
    '    useCache?: boolean',
    '  ): Promise<T>;',
    '',
  ];

  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (method === 'parameters') continue;
      output.push(generateMethod(path, method, operation));
    }
  }

  output.push('}');
  return output.join('\n');
}
```

**Method Template:**

```typescript
/**
 * ${operation.summary}
 * ${operation.description}
 *
 * Endpoint: ${method.toUpperCase()} ${path}
 * Scopes: ${extractScopes(operation.security)}
 * ${operation.deprecated ? '@deprecated' : ''}
 *
 * @param ${paramDocs}
 * @returns ${responseType}
 */
public async ${methodName}(
  ${parameters}
): Promise<${responseType}> {
  ${buildPath}
  ${buildQueryString}

  return this.makeRequest<${responseType}>(
    ${urlExpression},
    {
      method: '${method.toUpperCase()}',
      ${bodyOption}
    },
    ${useCache}
  );
}
```

---

### Phase 4: Main Client Integration

**Refactored `src/client.ts`:**

```typescript
import { EtsyClientGeneratedMethods } from './generated/client-methods';
import { EtsyRateLimiter } from './rate-limiting';
import { TokenManager } from './auth/token-manager';
import { BulkOperationManager } from './bulk-operations';
// ... other infrastructure imports

export class EtsyClient extends EtsyClientGeneratedMethods {
  private rateLimiter: EtsyRateLimiter;
  private tokenManager: TokenManager;
  private cache?: CacheStorage;
  private bulkOperationManager: BulkOperationManager;

  constructor(config: EtsyClientConfig) {
    super();
    // Initialize infrastructure...
  }

  /**
   * Core request implementation with rate limiting, caching, retry
   * This is the abstract method that generated methods call
   */
  protected async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache: boolean = true
  ): Promise<T> {
    // Existing implementation with:
    // - Cache check
    // - Rate limit wait
    // - Token refresh
    // - Retry on 429
    // - Error handling
  }

  // Bulk operations (NOT generated - hand-maintained)
  public async bulkUpdateListings(...) { ... }
  public async bulkUploadImages(...) { ... }

  // Utility methods (NOT generated)
  public getRateLimitStatus(): RateLimitStatus { ... }
  public async clearCache(): Promise<void> { ... }
}
```

---

### Phase 5: Validation Schema Generation

**Generator: `scripts/generate/generators/validation.mjs`**

```javascript
export function generateValidationSchemas(schemas, paths) {
  const requestBodySchemas = extractRequestBodySchemas(paths);

  const output = [
    '/**',
    ' * Etsy API v3 Validation Schemas',
    ' * Generated from OpenAPI spec - DO NOT EDIT MANUALLY',
    ' * @generated',
    ' */',
    '',
    'import { Validator, FieldValidator } from "../validation";',
    '',
  ];

  for (const [name, schema] of Object.entries(requestBodySchemas)) {
    output.push(generateValidationSchema(name, schema));
  }

  return output.join('\n');
}
```

**Example Output:**

```typescript
export const CreateDraftListingSchema = new Validator()
  .addRule('quantity', (field) => field.required().number({ min: 1 }))
  .addRule('title', (field) => field.required().string({ min: 1, max: 140 }))
  .addRule('description', (field) => field.required().string({ min: 1 }))
  .addRule('price', (field) => field.required().number({ min: 0.2, max: 50000 }))
  .addRule('who_made', (field) => field.required().enum(['i_did', 'someone_else', 'collective']))
  .addRule('when_made', (field) => field.required().enum([...WHEN_MADE_VALUES]))
  .addRule('taxonomy_id', (field) => field.required().number({ min: 1 }))
  .addRule('tags', (field) => field.optional().array({ maxItems: 13 }))
  .addRule('materials', (field) => field.optional().array({ maxItems: 13 }));
```

---

### Phase 6: Error Type Generation

**Generator: `scripts/generate/generators/errors.mjs`**

```javascript
export function generateErrors(paths) {
  const errorSchemas = extractErrorSchemas(paths);

  const output = [
    '/**',
    ' * Etsy API v3 Error Types',
    ' * Generated from OpenAPI spec - DO NOT EDIT MANUALLY',
    ' * @generated',
    ' */',
    '',
    'import { EtsyApiError } from "../types";',
    '',
  ];

  // Generate specific error classes
  output.push(generateErrorClasses(errorSchemas));

  return output.join('\n');
}
```

**Example Output:**

```typescript
export class EtsyValidationError extends EtsyApiError {
  public readonly field?: string;
  public readonly constraint?: string;

  constructor(message: string, details: { field?: string; constraint?: string }) {
    super(message, 400);
    this.name = 'EtsyValidationError';
    this.field = details.field;
    this.constraint = details.constraint;
  }
}

export class EtsyNotFoundError extends EtsyApiError {
  constructor(message: string, resourceType: string, resourceId: string | number) {
    super(`${resourceType} ${resourceId} not found: ${message}`, 404);
    this.name = 'EtsyNotFoundError';
  }
}

export class EtsyScopeError extends EtsyApiError {
  public readonly requiredScopes: string[];

  constructor(message: string, requiredScopes: string[]) {
    super(message, 403);
    this.name = 'EtsyScopeError';
    this.requiredScopes = requiredScopes;
  }
}
```

---

## NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "generate": "node scripts/generate/index.mjs",
    "generate:types": "node scripts/generate/index.mjs --types-only",
    "generate:client": "node scripts/generate/index.mjs --client-only",
    "generate:validation": "node scripts/generate/index.mjs --validation-only",
    "generate:check": "node scripts/generate/index.mjs --dry-run",
    "generate:diff": "node scripts/generate/index.mjs --diff",
    "spec:fetch": "curl -o spec/etsy-openapi.json https://www.etsy.com/openapi/generated/oas/3.0.0.json",
    "spec:validate": "node scripts/generate/index.mjs --validate-spec",
    "prebuild": "npm run generate"
  }
}
```

---

## Testing Strategy

### 1. Generator Unit Tests

```javascript
// scripts/generate/__tests__/types.test.mjs
describe('Type Generator', () => {
  it('generates interface from simple schema', () => { ... });
  it('handles optional properties', () => { ... });
  it('handles $ref references', () => { ... });
  it('generates union types from enum', () => { ... });
  it('handles nested objects', () => { ... });
});
```

### 2. Snapshot Testing

- Generate types from spec
- Compare with existing `src/types.ts`
- Ensure all interfaces are covered
- Flag any missing or changed types

### 3. Integration Testing

- Run existing test suite against generated code
- Ensure all API methods work correctly
- Verify rate limiting/caching still functions

---

## Migration Checklist

### Pre-Migration
- [ ] Create `feature/openapi-codegen` branch
- [ ] Fetch and commit OpenAPI spec to `spec/etsy-openapi.json`
- [ ] Create `scripts/generate/` directory structure
- [ ] Create `src/generated/` directory

### Generator Implementation
- [ ] Implement OpenAPI parser (`parser.mjs`)
- [ ] Implement type generator (`generators/types.mjs`)
- [ ] Implement client method generator (`generators/client.mjs`)
- [ ] Implement validation generator (`generators/validation.mjs`)
- [ ] Implement error generator (`generators/errors.mjs`)
- [ ] Add CLI with flags (`index.mjs`)

### Integration
- [ ] Generate initial types file
- [ ] Generate initial client methods file
- [ ] Refactor `EtsyClient` to extend generated base class
- [ ] Update imports throughout codebase
- [ ] Update `src/index.ts` exports

### Quality Assurance
- [ ] All existing tests pass
- [ ] No breaking changes to public API
- [ ] Generated code compiles without errors
- [ ] JSDoc comments are complete
- [ ] Build produces correct output formats

### Documentation
- [ ] Update README with generation workflow
- [ ] Document how to update when Etsy releases new API version
- [ ] Add contributing guidelines for spec updates

---

## Success Criteria

1. **Type Completeness**: All interfaces from `components.schemas` are generated
2. **Method Coverage**: All API endpoints from `paths` have generated methods
3. **Validation Coverage**: Request body schemas have validation rules
4. **Error Handling**: Error responses have typed error classes
5. **Backward Compatibility**: Existing tests pass, public API unchanged
6. **Code Quality**: Generated code is readable, well-documented, follows project style
7. **Build Integrity**: All build outputs (ESM/CJS/UMD) work correctly

---

## Appendix: Etsy-Specific Patterns

### Money Objects

Etsy uses a consistent pattern for monetary values:

```json
{
  "price": {
    "amount": 1999,
    "divisor": 100,
    "currency_code": "USD"
  }
}
```

The generator should:
1. Detect this pattern
2. Generate a shared `EtsyMoney` interface
3. Reference it in all price-related fields

### Pagination Response

Most list endpoints return:

```json
{
  "count": 25,
  "results": [...],
  "pagination": {
    "effective_limit": 25,
    "effective_offset": 0,
    "next_offset": 25
  }
}
```

Generate `EtsyApiResponse<T>` wrapper type.

### Timestamp Fields

Etsy uses Unix timestamps (seconds since epoch):

```typescript
// Generate as number, add JSDoc
/** Unix timestamp in seconds */
created_timestamp: number;
```

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Foundation Setup
3. Iterate through implementation phases
4. Test and validate at each phase
5. Final integration and testing
6. Merge to main branch
