import { Type, type TSchema, type TObject, type TProperties } from "@sinclair/typebox";

export class SchemaConverter {
  static convertJsonSchemaToTypeBox(schema: Record<string, unknown>): TSchema {
    if (!schema || typeof schema !== "object") {
      return Type.Any();
    }

    const schemaType = (schema.type as string) || "any";

    switch (schemaType) {
      case "object":
        return this.convertObjectSchema(schema);
      case "array":
        return this.convertArraySchema(schema);
      case "string":
        return this.convertStringSchema(schema);
      case "number":
        return this.convertNumberSchema(schema);
      case "integer":
        return this.convertIntegerSchema(schema);
      case "boolean":
        return Type.Boolean();
      case "null":
        return Type.Null();
      default:
        return Type.Any();
    }
  }

  private static convertObjectSchema(schema: Record<string, unknown>): TObject {
    const properties = (schema.properties as Record<string, unknown>) || {};
    const required = (schema.required as string[]) || [];

    const typeBoxProps: TProperties = {};

    for (const [key, value] of Object.entries(properties)) {
      const propSchema = value as Record<string, unknown>;
      const isRequired = required.includes(key);
      const converted = this.convertJsonSchemaToTypeBox(propSchema);

      if (isRequired) {
        typeBoxProps[key] = converted;
      } else {
        typeBoxProps[key] = Type.Optional(converted);
      }
    }

    return Type.Object(typeBoxProps);
  }

  private static convertArraySchema(schema: Record<string, unknown>) {
    const items = schema.items as Record<string, unknown> | undefined;
    if (items) {
      const itemType = this.convertJsonSchemaToTypeBox(items);
      return Type.Array(itemType);
    }
    return Type.Array(Type.Any());
  }

  private static convertStringSchema(schema: Record<string, unknown>) {
    const enumValues = schema.enum as string[] | undefined;
    if (enumValues && enumValues.length > 0) {
      return Type.Union(enumValues.map((v) => Type.Literal(v)));
    }

    const minLength = schema.minLength as number | undefined;
    const maxLength = schema.maxLength as number | undefined;
    const pattern = schema.pattern as string | undefined;

    const options: { minLength?: number; maxLength?: number; pattern?: string } = {};
    if (minLength !== undefined) options.minLength = minLength;
    if (maxLength !== undefined) options.maxLength = maxLength;
    if (pattern !== undefined) options.pattern = pattern;

    return Type.String(options);
  }

  private static convertNumberSchema(schema: Record<string, unknown>) {
    const minimum = schema.minimum as number | undefined;
    const maximum = schema.maximum as number | undefined;

    const options: { minimum?: number; maximum?: number } = {};
    if (minimum !== undefined) options.minimum = minimum;
    if (maximum !== undefined) options.maximum = maximum;

    return Type.Number(options);
  }

  private static convertIntegerSchema(schema: Record<string, unknown>) {
    const minimum = schema.minimum as number | undefined;
    const maximum = schema.maximum as number | undefined;

    const options: { minimum?: number; maximum?: number } = {};
    if (minimum !== undefined) options.minimum = minimum;
    if (maximum !== undefined) options.maximum = maximum;

    return Type.Integer(options);
  }
}
