import { describe, expect, it } from "vitest";
import { validate, type JsonSchema } from "./json-schema-lite";

const noRefs = () => undefined;
const errorsFor = (value: unknown, schema: JsonSchema) =>
  validate(value, schema, noRefs);

describe("validate: types", () => {
  it("accepts a value of the declared type and rejects another", () => {
    expect(errorsFor("a", { type: "string" })).toEqual([]);
    expect(errorsFor(1, { type: "string" })).toHaveLength(1);
    expect(errorsFor(true, { type: "boolean" })).toEqual([]);
    expect(errorsFor([], { type: "array" })).toEqual([]);
    expect(errorsFor({}, { type: "object" })).toEqual([]);
    expect(errorsFor(null, { type: "null" })).toEqual([]);
  });

  it("tells integers from other numbers", () => {
    expect(errorsFor(3, { type: "integer" })).toEqual([]);
    expect(errorsFor(3.5, { type: "integer" })).toHaveLength(1);
    expect(errorsFor(3.5, { type: "number" })).toEqual([]);
  });

  it("does not take null or an array for an object", () => {
    expect(errorsFor(null, { type: "object" })).toHaveLength(1);
    expect(errorsFor([], { type: "object" })).toHaveLength(1);
    expect(errorsFor({}, { type: "array" })).toHaveLength(1);
  });

  it("accepts any member of a type list", () => {
    const schema = { type: ["string", "null"] };
    expect(errorsFor("a", schema)).toEqual([]);
    expect(errorsFor(null, schema)).toEqual([]);
    expect(errorsFor(1, schema)).toHaveLength(1);
  });

  it("names the path of the failing value", () => {
    const [message] = errorsFor(
      { items: [{ id: "x" }] },
      {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "object", properties: { id: { type: "integer" } } },
          },
        },
      },
    );
    expect(message).toContain("$.items[0].id");
  });
});

describe("validate: constraints", () => {
  it("fails a value outside the enum", () => {
    expect(errorsFor("b", { enum: ["a", "c"] })).toHaveLength(1);
    expect(errorsFor("a", { enum: ["a", "c"] })).toEqual([]);
  });

  it("fails a value that differs from the const", () => {
    expect(errorsFor("2.0", { const: "2.0" })).toEqual([]);
    expect(errorsFor("1.0", { const: "2.0" })).toHaveLength(1);
  });

  it("fails a number below the minimum", () => {
    expect(errorsFor(-1, { type: "integer", minimum: 0 })).toHaveLength(1);
    expect(errorsFor(0, { type: "integer", minimum: 0 })).toEqual([]);
  });

  it("fails a missing required key", () => {
    const schema = { type: "object", required: ["a", "b"], properties: {} };
    expect(errorsFor({ a: 1 }, schema)).toHaveLength(1);
    expect(errorsFor({ a: 1, b: 2 }, schema)).toEqual([]);
  });

  it("fails a property of the wrong type but ignores a property it does not know", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    expect(errorsFor({ a: 1 }, schema)).toHaveLength(1);
    expect(errorsFor({ a: "x", extra: 1 }, schema)).toEqual([]);
  });

  it("skips an optional property that is absent", () => {
    const schema = { type: "object", properties: { a: { type: "string" } } };
    expect(errorsFor({}, schema)).toEqual([]);
  });

  it("checks every array item and reports each failure", () => {
    const schema = { type: "array", items: { type: "string" } };
    expect(errorsFor(["a", 1, 2], schema)).toHaveLength(2);
  });

  it("ignores keywords it does not implement", () => {
    expect(
      errorsFor("x", { type: "string", format: "uri", description: "d" }),
    ).toEqual([]);
  });
});

describe("validate: $ref", () => {
  const registry: Record<string, JsonSchema> = {
    "#/components/schemas/Name": { type: "string" },
  };
  const resolve = (ref: string) => registry[ref];

  it("follows a reference through the resolver", () => {
    const schema = { $ref: "#/components/schemas/Name" };
    expect(validate("a", schema, resolve)).toEqual([]);
    expect(validate(1, schema, resolve)).toHaveLength(1);
  });

  it("follows a reference nested in properties and items", () => {
    const schema = {
      type: "object",
      properties: {
        names: { type: "array", items: { $ref: "#/components/schemas/Name" } },
      },
    };
    expect(validate({ names: ["a", "b"] }, schema, resolve)).toEqual([]);
    expect(validate({ names: ["a", 2] }, schema, resolve)).toHaveLength(1);
  });

  it("reports a reference the resolver cannot find instead of passing", () => {
    const [message] = validate(
      "a",
      { $ref: "#/components/schemas/Missing" },
      resolve,
    );
    expect(message).toContain("#/components/schemas/Missing");
  });
});

describe("validate: strict mode", () => {
  const schema = {
    type: "object",
    properties: {
      a: { type: "string" },
      nested: { type: "object", properties: { b: { type: "string" } } },
      list: { type: "array", items: { type: "object", properties: { c: { type: "string" } } } },
    },
  };
  const strict = (value: unknown) => validate(value, schema, noRefs, { rejectUndeclaredKeys: true });

  it("accepts a body that declares every key it has", () => {
    expect(strict({ a: "x", nested: { b: "y" }, list: [{ c: "z" }] })).toEqual([]);
  });

  it("names a key the schema does not declare, at any depth", () => {
    expect(strict({ extra: 1 })[0]).toContain('$.extra');
    expect(strict({ nested: { extra: 1 } })[0]).toContain("$.nested.extra");
    expect(strict({ list: [{ c: "z", extra: 1 }] })[0]).toContain("$.list[0].extra");
  });

  it("stays lenient by default", () => {
    expect(validate({ extra: 1 }, schema, noRefs)).toEqual([]);
  });

  it("leaves an object without declared properties alone", () => {
    expect(validate({ any: 1 }, { type: "object" }, noRefs, { rejectUndeclaredKeys: true })).toEqual([]);
  });
});

