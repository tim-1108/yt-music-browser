import type { MapLike } from "typescript";

interface BaseSchemaEntry {
	key: string;
	required?: boolean;
	fn?: (value: any, schema: SchemaEntry) => boolean;
}

export interface ArraySchemaEntry extends BaseSchemaEntry {
	type: "array";
	array_type?: "string" | "boolean" | "number";
	options?: any[];
}

export interface BooleanSchemaEntry extends BaseSchemaEntry {
	type: "boolean";
}

export interface NumberSchemaEntry extends BaseSchemaEntry {
	type: "number";
	disallow_floats?: boolean;
	min?: number;
	max?: number;
}

export interface StringSchemaEntry extends BaseSchemaEntry {
	type: "string";
	options?: any[];
	pattern?: RegExp;
}

export type SchemaEntry = ArraySchemaEntry | BooleanSchemaEntry | StringSchemaEntry | NumberSchemaEntry;

export function validateSchema(entries: SchemaEntry[], data: MapLike<any>) {
	const violations: string[] = [];
	const foundKeys: string[] = [];
	for (const key of Object.keys(data)) {
		const value = data[key];
		const schema = entries.find((entry) => entry.key === key);
		if (schema === undefined) {
			violations.push("Unknown in schema: " + key);
			continue;
		}

		foundKeys.push(key);

		const functionResult = schema.fn ? schema.fn(value, schema) : true;
		if (!functionResult) {
			violations.push("Validator function failed for: " + key);
			continue;
		}

		if (schema.type === "string" || schema.type === "boolean" || schema.type === "number") {
			const isInvalidType = typeof value !== schema.type;
			if (isInvalidType) {
				violations.push("Primitive type invalid for: " + key);
				continue;
			}
		}

		if (schema.type === "number") {
			const isTooSmall = (schema.min !== undefined ? schema.min : Number.MIN_SAFE_INTEGER) > value;
			const isTooLarge = (schema.max !== undefined ? schema.max : Number.MAX_SAFE_INTEGER) < value;
			const invalidAsFloat = schema.disallow_floats && !Number.isInteger(value);
			if (isTooSmall || isTooLarge || invalidAsFloat) violations.push("Number is too large, too small or cannot be a float for: " + key);
			continue;
		}

		if (schema.type === "string") {
			if (schema.pattern && !schema.pattern.test(value)) {
				violations.push("Pattern does not match for: " + key);
				continue;
			}
			if (!schema.options) continue;
			const isIncluded = schema.options.includes(value);
			if (!isIncluded) violations.push("Value not included in array options for: " + key);
			continue;
		}

		if (schema.type === "array") {
			if (!Array.isArray(value)) {
				violations.push("Expected array for: " + key);
				continue;
			}
			// If no options for the array are given, we'll just assume it's valid
			if (!schema.options && !schema.array_type) continue;
			for (const arrayItem of value) {
				const isOfType = schema.array_type ? typeof arrayItem === schema.array_type : true;
				const isIncluded = schema.options ? schema.options.includes(arrayItem) : true;
				if (!isIncluded || !isOfType) violations.push("Value is not an option or invalid for: " + key);
			}
		}
	}

	const anyRequiredKeysMissing = entries.filter((entry) => entry.required).some((entry) => !foundKeys.includes(entry.key));
	if (anyRequiredKeysMissing) violations.push("Required keys missing");

	return { violations, failed: violations.length > 0 };
}

function clampNumber(number: number, min: number, max: number) {
	return Math.min(Math.max(number, min), max);
}
