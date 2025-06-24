/**
 Matches a JSON object.

 This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. Don't use this as a direct return type as the user would have to double-cast it: `jsonObject as unknown as CustomResponse`. Instead, you could extend your CustomResponse type from it to ensure your type only uses JSON-compatible types: `interface CustomResponse extends JsonObject { … }`.

 @category JSON
 */
type JsonObject = { [Key in string]: JsonValue } & { [Key in string]?: JsonValue | undefined };

/**
 Matches a JSON array.

 @category JSON
 */
type JsonArray = JsonValue[] | readonly JsonValue[];

/**
 Matches any valid JSON primitive value.

 @category JSON
 */
type JsonPrimitive = string | number | boolean | null;

/**
 Matches any valid JSON value.

 @see `Jsonify` if you need to transform a type to one that is assignable to `JsonValue`.

 @category JSON
 */
type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type RemoteConfigContract = Record<string, JsonValue>