import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GLB_MAGIC = 0x46546c67;
const GLB_JSON_CHUNK = 0x4e4f534a;
const MIN_VERTICAL_EXTENT = 15;
const MAX_HERO_PRIMITIVES = 150;

const FLOOR_KEYS = [
  "parking-p1",
  "reclamation-core",
  "commons-clinic",
  "power-ops-core",
  "aquaponics-bay",
  "vertical-farm",
  "residences-a",
  "residences-b",
  "residences-c",
  "residences-d",
  "the-lung",
  "penthouses",
  "skydeck-reservoir",
];

const REQUIRED_HERO_NODES = [
  "sys.vertical-transport",
  "car.a",
  "car.b",
  "car.ff",
];

const NEED_MATERIALS = [
  "mat.need.water",
  "mat.need.energy",
  "mat.need.food",
  "mat.need.shelter",
  "mat.need.air",
  "mat.need.health",
  "mat.need.restoration",
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const heroPath = "public/models/atlas-01.glb";
const canonicalFloorPaths = FLOOR_KEYS.map(
  (key) => `public/models/floor-${key}.glb`,
);

const errors = [];
const warnings = [];

function parseGlb(relativeFilePath) {
  const absolutePath = resolve(repoRoot, relativeFilePath);
  const bytes = readFileSync(absolutePath);

  if (bytes.length < 20) {
    throw new Error("file is too short to be a GLB");
  }

  if (bytes.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("invalid GLB magic");
  }

  const version = bytes.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`unsupported GLB version ${version}`);
  }

  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    throw new Error(
      `declared length ${declaredLength} does not match ${bytes.length} bytes`,
    );
  }

  let offset = 12;
  let json;

  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;

    if (chunkEnd > bytes.length) {
      throw new Error("GLB chunk exceeds the declared file length");
    }

    if (chunkType === GLB_JSON_CHUNK) {
      const source = bytes
        .toString("utf8", chunkStart, chunkEnd)
        .replace(/\u0000+$/u, "")
        .trimEnd();
      json = JSON.parse(source);
      break;
    }

    offset = chunkEnd;
  }

  if (!json) {
    throw new Error("missing GLB JSON chunk");
  }

  return { bytes, json };
}

function identityMatrix() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function multiplyMatrices(a, b) {
  const result = new Array(16).fill(0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let index = 0; index < 4; index += 1) {
        result[column * 4 + row] +=
          a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }
  return result;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) {
    return node.matrix;
  }

  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];

  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function transformPoint(matrix, [x, y, z]) {
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

function collectDescendants(nodes, rootIndex, selected) {
  if (selected.has(rootIndex)) {
    return;
  }
  selected.add(rootIndex);
  for (const childIndex of nodes[rootIndex]?.children ?? []) {
    collectDescendants(nodes, childIndex, selected);
  }
}

function floorStackNodeIndexes(json) {
  const nodes = json.nodes ?? [];
  const selected = new Set();

  nodes.forEach((node, index) => {
    if (
      FLOOR_KEYS.some(
        (key) => node.name === key || node.name?.startsWith(`${key}.`),
      )
    ) {
      selected.add(index);
    }
  });

  nodes.forEach((node, index) => {
    if (FLOOR_KEYS.includes(node.name)) {
      collectDescendants(nodes, index, selected);
    }
  });

  return selected;
}

function assetBounds(json, selectedNodeIndexes) {
  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  const parents = new Array(nodes.length).fill(-1);
  const worldMatrices = new Array(nodes.length);

  nodes.forEach((node, parentIndex) => {
    for (const childIndex of node.children ?? []) {
      if (parents[childIndex] === -1) {
        parents[childIndex] = parentIndex;
      }
    }
  });

  function worldMatrix(index, active = new Set()) {
    if (worldMatrices[index]) {
      return worldMatrices[index];
    }
    if (active.has(index)) {
      throw new Error(`node hierarchy contains a cycle at index ${index}`);
    }

    active.add(index);
    const local = nodeMatrix(nodes[index] ?? {});
    const parentIndex = parents[index];
    const world =
      parentIndex === -1
        ? local
        : multiplyMatrices(worldMatrix(parentIndex, active), local);
    active.delete(index);
    worldMatrices[index] = world;
    return world;
  }

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let positionAccessors = 0;

  nodes.forEach((node, nodeIndex) => {
    if (selectedNodeIndexes && !selectedNodeIndexes.has(nodeIndex)) {
      return;
    }
    if (!Number.isInteger(node.mesh)) {
      return;
    }

    const matrix = worldMatrix(nodeIndex);
    for (const primitive of meshes[node.mesh]?.primitives ?? []) {
      const accessorIndex = primitive.attributes?.POSITION;
      const accessor = accessors[accessorIndex];
      if (
        !accessor ||
        !Array.isArray(accessor.min) ||
        !Array.isArray(accessor.max) ||
        accessor.min.length < 3 ||
        accessor.max.length < 3
      ) {
        continue;
      }

      positionAccessors += 1;
      const [minX, minY, minZ] = accessor.min;
      const [maxX, maxY, maxZ] = accessor.max;
      for (const x of [minX, maxX]) {
        for (const y of [minY, maxY]) {
          for (const z of [minZ, maxZ]) {
            const point = transformPoint(matrix, [x, y, z]);
            for (let axis = 0; axis < 3; axis += 1) {
              min[axis] = Math.min(min[axis], point[axis]);
              max[axis] = Math.max(max[axis], point[axis]);
            }
          }
        }
      }
    }
  });

  return {
    min,
    max,
    extent: max.map((value, axis) => value - min[axis]),
    positionAccessors,
  };
}

function isFiniteNonzeroBounds(bounds) {
  return (
    bounds.positionAccessors > 0 &&
    bounds.min.every(Number.isFinite) &&
    bounds.max.every(Number.isFinite) &&
    bounds.extent.every((value) => Number.isFinite(value) && value > 0)
  );
}

function formatExtent(extent) {
  return extent.map((value) => value.toFixed(3)).join(" × ");
}

function validateHero() {
  console.log(`HERO ${heroPath}`);

  let parsed;
  try {
    parsed = parseGlb(heroPath);
  } catch (error) {
    errors.push(`${heroPath}: ${error.message}`);
    console.error(`  FAIL ${error.message}`);
    return;
  }

  const { json } = parsed;
  const nodeNames = new Set(
    (json.nodes ?? []).map((node) => node.name).filter(Boolean),
  );
  const materialNames = new Set(
    (json.materials ?? []).map((material) => material.name).filter(Boolean),
  );

  const missingFloorRoots = FLOOR_KEYS.filter((key) => !nodeNames.has(key));
  if (missingFloorRoots.length > 0) {
    const message = `missing exact floor roots: ${missingFloorRoots.join(", ")}`;
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else {
    console.log(`  PASS exact floor roots (${FLOOR_KEYS.length})`);
  }

  const missingRequiredNodes = REQUIRED_HERO_NODES.filter(
    (name) => !nodeNames.has(name),
  );
  if (missingRequiredNodes.length > 0) {
    const message = `missing required nodes: ${missingRequiredNodes.join(", ")}`;
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else {
    console.log(`  PASS required transport nodes (${REQUIRED_HERO_NODES.length})`);
  }

  const missingMaterials = NEED_MATERIALS.filter(
    (name) => !materialNames.has(name),
  );
  if (missingMaterials.length > 0) {
    const message = `missing required materials: ${missingMaterials.join(", ")}`;
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else {
    console.log(`  PASS need materials (${NEED_MATERIALS.length})`);
  }

  const floorBounds = assetBounds(json, floorStackNodeIndexes(json));
  if (!isFiniteNonzeroBounds(floorBounds)) {
    const message = "floor-stack bounds are missing, non-finite, or zero-sized";
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else if (floorBounds.extent[1] <= MIN_VERTICAL_EXTENT) {
    const message =
      `app-native Y floor-stack extent ${floorBounds.extent[1].toFixed(3)} ` +
      `must be > ${MIN_VERTICAL_EXTENT} (XYZ: ${formatExtent(floorBounds.extent)})`;
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else {
    console.log(
      `  PASS app-native Y floor-stack extent ${floorBounds.extent[1].toFixed(3)}`,
    );
  }

  const primitiveCount = (json.meshes ?? []).reduce(
    (count, mesh) => count + (mesh.primitives?.length ?? 0),
    0,
  );
  if (primitiveCount > MAX_HERO_PRIMITIVES) {
    const message =
      `hero primitive count ${primitiveCount} exceeds ${MAX_HERO_PRIMITIVES}`;
    errors.push(`${heroPath}: ${message}`);
    console.error(`  FAIL ${message}`);
  } else {
    console.log(`  PASS hero primitive count ${primitiveCount}`);
  }
}

function validateCanonicalFloors() {
  console.log(`\nCANONICAL FLOORS (${canonicalFloorPaths.length})`);
  const hashes = new Map();

  for (const floorPath of canonicalFloorPaths) {
    let parsed;
    try {
      parsed = parseGlb(floorPath);
    } catch (error) {
      const message = `${floorPath}: ${error.message}`;
      errors.push(message);
      console.error(`  FAIL ${message}`);
      continue;
    }

    const bounds = assetBounds(parsed.json);
    if (!isFiniteNonzeroBounds(bounds)) {
      const message = `${floorPath}: bounds are missing, non-finite, or zero-sized`;
      errors.push(message);
      console.error(`  FAIL ${message}`);
      continue;
    }

    const hash = createHash("sha256").update(parsed.bytes).digest("hex");
    const matchingPaths = hashes.get(hash) ?? [];
    matchingPaths.push(floorPath);
    hashes.set(hash, matchingPaths);
    console.log(`  PASS ${floorPath} bounds ${formatExtent(bounds.extent)}`);
  }

  for (const matchingPaths of hashes.values()) {
    if (matchingPaths.length < 2) {
      continue;
    }
    const message =
      `byte-identical canonical assets: ` +
      matchingPaths.join(", ");
    warnings.push(message);
    console.warn(`  WARN ${message}`);
  }
}

validateHero();
validateCanonicalFloors();

console.log(
  `\n${errors.length === 0 ? "PASS" : "FAILED"} glTF asset contract: ` +
    `${errors.length} error(s), ${warnings.length} warning(s)`,
);

if (errors.length > 0) {
  process.exitCode = 1;
}
