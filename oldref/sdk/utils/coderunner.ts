function deepFreeze<T>(obj: T): T {
  // Get all property names (including non-enumerable ones)
  const propNames = Object.getOwnPropertyNames(obj);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = (obj as any)[name];
    
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

async function asyncExecReadonly(
  code: string,
  globals: Record<string, any> = {},
  passThrough: string[] = ['eagle'] // Variables to pass through without freezing
): Promise<any> {
  const keys = Object.keys(globals);
  const values = Object.values(globals);

  // Deep freeze values to prevent any mutations, except for passThrough variables
  const frozenValues = values.map((v, index) => {
    const key = keys[index];
    
    // Don't freeze passthrough variables
    if (passThrough.includes(key)) {
      return v;
    }
    
    if (typeof v === "object" && v !== null) {
      // Create a deep copy first to avoid modifying original
      const copy = JSON.parse(JSON.stringify(v));
      return deepFreeze(copy);
    }
    return v;
  });

  const fn = new Function(
    ...keys,
    `
    "use strict";
    return (async () => {
      ${code}
    })();
  `
  );

  return await fn(...frozenValues);
}

export { asyncExecReadonly };
