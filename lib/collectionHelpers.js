/**
 * Collection Setup Helpers
 * Shared helper functions for creating collections, attributes, and indexes
 */

/**
 * Create or verify an attribute exists
 */
export async function ensureAttribute(databases, db, col, spec) {
  // Check if attribute already exists
  try {
    const attributes = await databases.listAttributes(db, col);
    const exists = attributes.attributes.some((a) => a.key === spec.key);
    if (exists) {
      return { status: 'exists', message: `Attribute ${spec.key} already exists` };
    }
  } catch (err) {
    if (err.code !== 404) {
      return { status: 'error', message: `Error checking attribute: ${err.message}` };
    }
  }

  // Create the attribute
  const req = spec.required === true;
  const arr = spec.array === true;
  const def = spec.default;

  try {
    switch (spec.type) {
      case 'string':
        await databases.createStringAttribute(
          db, col, spec.key,
          spec.size || 190,
          req,
          def,
          arr
        );
        break;
      case 'email':
        await databases.createEmailAttribute(db, col, spec.key, req, def, arr);
        break;
      case 'url':
        await databases.createUrlAttribute(db, col, spec.key, req, def, arr);
        break;
      case 'ip':
        await databases.createIpAttribute(db, col, spec.key, req, def, arr);
        break;
      case 'integer':
        await databases.createIntegerAttribute(
          db, col, spec.key, req,
          spec.min || null,
          spec.max || null,
          def,
          arr
        );
        break;
      case 'float':
        await databases.createFloatAttribute(
          db, col, spec.key, req,
          spec.min || null,
          spec.max || null,
          def,
          arr
        );
        break;
      case 'boolean':
        await databases.createBooleanAttribute(db, col, spec.key, req, def, arr);
        break;
      case 'datetime':
        await databases.createDatetimeAttribute(db, col, spec.key, req, def, arr);
        break;
      case 'enum':
        if (!spec.elements || !Array.isArray(spec.elements)) {
          throw new Error(`Enum attribute ${col}.${spec.key} requires 'elements' array`);
        }
        await databases.createEnumAttribute(
          db, col, spec.key,
          spec.elements,
          req,
          def,
          arr
        );
        break;
      case 'json':
        // JSON type stored as large string
        await databases.createStringAttribute(
          db, col, spec.key,
          spec.size || 10000,
          req,
          def,
          arr
        );
        break;
      default:
        throw new Error(`Unknown attribute type for ${col}.${spec.key}: ${spec.type}`);
    }
    return { status: 'created', message: `Created attribute ${spec.key} (${spec.type})` };
  } catch (err) {
    return { status: 'error', message: `Failed to create attribute ${spec.key}: ${err.message}` };
  }
}

/**
 * Create or verify an index exists
 */
export async function ensureIndex(databases, db, col, key, type, attributes, orders) {
  // Check if index already exists
  try {
    const indexes = await databases.listIndexes(db, col);
    const exists = indexes.indexes.some((i) => i.key === key);
    if (exists) {
      return { status: 'exists', message: `Index ${key} already exists` };
    }
  } catch (err) {
    if (err.code !== 404) {
      return { status: 'error', message: `Error checking index: ${err.message}` };
    }
  }

  // Create the index
  try {
    await databases.createIndex(db, col, key, type, attributes, orders || attributes.map(() => 'ASC'));
    return { status: 'created', message: `Created index ${key} [${type}] (${attributes.join(', ')})` };
  } catch (err) {
    return { status: 'error', message: `Failed to create index ${key}: ${err.message}` };
  }
}
