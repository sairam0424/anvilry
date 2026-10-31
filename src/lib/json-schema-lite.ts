/**
 * A deliberately tiny JSON Schema validator for the contract tests: it checks that a response
 * body has the shape its OpenAPI schema promises. It implements only the keywords the API's
 * schemas use (type, enum, const, required, properties, items, minimum, $ref) and ignores every
 * other keyword, so it proves the shape and nothing more. It is a test helper, not a request
 * validator: nothing at runtime imports it.
 */

export type JsonSchema = Record<string, unknown>;

/** Looks a `$ref` up, for example "#/components/schemas/Error". Undefined means it cannot. */
export type RefResolver = (ref: string) => JsonSchema | undefined;

export interface ValidateOptions {
  /** Also fail a key the schema's `properties` does not declare, so a spec that omits a field is caught. */
  rejectUndeclaredKeys?: boolean;
}

interface Context {
  resolve: RefResolver;
  rejectUndeclaredKeys: boolean;
}

type Check = (
  value: unknown,
  schema: JsonSchema,
  path: string,
  ctx: Context,
) => string[];

const TYPE_TESTS: Record<string, (value: unknown) => boolean> = {
  string: (v) => typeof v === "string",
  number: (v) => typeof v === "number" && Number.isFinite(v),
  integer: (v) => Number.isInteger(v),
  boolean: (v) => typeof v === "boolean",
  null: (v) => v === null,
  array: (v) => Array.isArray(v),
  object: (v) => typeof v === "object" && v !== null && !Array.isArray(v),
};

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const describeValue = (value: unknown) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

const checkType: Check = (value, schema, path) => {
  if (schema.type === undefined) return [];
  const allowed = (
    Array.isArray(schema.type) ? schema.type : [schema.type]
  ) as string[];
  const matches = allowed.some((name) => TYPE_TESTS[name]?.(value) ?? false);
  return matches
    ? []
    : [
        `${path}: expected ${allowed.join(" or ")}, got ${describeValue(value)}`,
      ];
};

const checkEnum: Check = (value, schema, path) => {
  const options = schema.enum as unknown[] | undefined;
  if (!options || options.some((option) => sameJson(option, value))) return [];
  return [
    `${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(options)}`,
  ];
};

const checkConst: Check = (value, schema, path) => {
  if (!("const" in schema) || sameJson(schema.const, value)) return [];
  return [`${path}: expected the constant ${JSON.stringify(schema.const)}`];
};

const checkMinimum: Check = (value, schema, path) => {
  const { minimum } = schema;
  if (
    typeof minimum !== "number" ||
    typeof value !== "number" ||
    value >= minimum
  )
    return [];
  return [`${path}: ${value} is below the minimum ${minimum}`];
};

const checkObject: Check = (value, schema, path, ctx) => {
  if (!TYPE_TESTS.object(value)) return [];
  const record = value as Record<string, unknown>;
  const properties = schema.properties as
    Record<string, JsonSchema> | undefined;
  const missing = ((schema.required as string[] | undefined) ?? [])
    .filter((key) => !(key in record))
    .map((key) => `${path}: missing required key "${key}"`);
  const undeclared =
    ctx.rejectUndeclaredKeys && properties
      ? Object.keys(record)
          .filter((key) => !(key in properties))
          .map((key) => `${path}.${key}: key is not declared in the schema`)
      : [];
  const nested = Object.entries(properties ?? {})
    .filter(([key]) => key in record)
    .flatMap(([key, child]) =>
      check(record[key], child, `${path}.${key}`, ctx),
    );
  return [...missing, ...undeclared, ...nested];
};

const checkItems: Check = (value, schema, path, ctx) => {
  const items = schema.items as JsonSchema | undefined;
  if (!items || !Array.isArray(value)) return [];
  return value.flatMap((item, index) =>
    check(item, items, `${path}[${index}]`, ctx),
  );
};

function check(
  value: unknown,
  schema: JsonSchema,
  path: string,
  ctx: Context,
): string[] {
  if (typeof schema.$ref === "string") {
    const target = ctx.resolve(schema.$ref);
    if (!target) return [`${path}: cannot resolve ${schema.$ref}`];
    return check(value, target, path, ctx);
  }
  const typeErrors = checkType(value, schema, path, ctx);
  if (typeErrors.length > 0) return typeErrors;
  return [checkEnum, checkConst, checkMinimum, checkObject, checkItems].flatMap(
    (rule) => rule(value, schema, path, ctx),
  );
}

/** Every way `value` breaks `schema`, as readable messages that start with the JSON path. Empty means valid. */
export function validate(
  value: unknown,
  schema: JsonSchema,
  resolveRef: RefResolver,
  options: ValidateOptions = {},
): string[] {
  return check(value, schema, "$", {
    resolve: resolveRef,
    rejectUndeclaredKeys: options.rejectUndeclaredKeys ?? false,
  });
}
