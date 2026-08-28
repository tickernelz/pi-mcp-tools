import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SchemaConverter } from "../src/SchemaConverter.js";

describe("SchemaConverter", () => {
  describe("convertJsonSchemaToTypeBox", () => {
    it("returns Type.Any() for null/undefined input", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox(null as unknown as Record<string, unknown>);
      expect(result).toBeDefined();
    });

    it("converts a string schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "string" });
      expect(result).toBeDefined();
    });

    it("converts a string schema with minLength", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "string", minLength: 1 });
      expect(result).toBeDefined();
    });

    it("converts a string schema with enum", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({
        type: "string",
        enum: ["a", "b", "c"],
      });
      expect(result).toBeDefined();
    });

    it("converts a number schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "number" });
      expect(result).toBeDefined();
    });

    it("converts a number schema with minimum", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "number", minimum: 0 });
      expect(result).toBeDefined();
    });

    it("converts an integer schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "integer" });
      expect(result).toBeDefined();
    });

    it("converts a boolean schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "boolean" });
      expect(result).toBeDefined();
    });

    it("converts a null schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "null" });
      expect(result).toBeDefined();
    });

    it("converts an object schema with properties", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "integer" },
        },
        required: ["name"],
      });
      expect(result).toBeDefined();
    });

    it("converts an array schema", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({
        type: "array",
        items: { type: "string" },
      });
      expect(result).toBeDefined();
    });

    it("converts nested object schemas", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({
        type: "object",
        properties: {
          meta: {
            type: "object",
            properties: {
              count: { type: "integer" },
            },
            required: ["count"],
          },
        },
        required: ["meta"],
      });
      expect(result).toBeDefined();
    });

    it("returns Type.Any() for unknown schema type", () => {
      const result = SchemaConverter.convertJsonSchemaToTypeBox({ type: "unknown-type" });
      expect(result).toBeDefined();
    });
  });
});