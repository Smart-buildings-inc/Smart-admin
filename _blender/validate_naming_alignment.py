#!/usr/bin/env python3
"""
validate_naming_alignment.py

Cross-reference floor keys between three sources:
  1. Data model seed data  (Smart-admin/src/lib/db/seed-data.ts)
  2. Blender FLOORS list   (_blender/build_atlas_floors.py)
  3. models.ts slot registry (src/lib/models.ts)

Exits 0 if expected mapping holds, 1 on unexpected mismatches.
Use --strict to also warn about known one-to-many mappings.
"""

import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent  # _blender is inside Smart-admin
SEED_FILE = HERE / "src/lib/db/seed-data.ts"
BLENDER_FILE = HERE / "_blender/build_atlas_floors.py"
MODELS_FILE = HERE / "src/lib/models.ts"


def parse_seed_keys(text):
    keys = []
    for m in re.finditer(r'^\s+key:\s+"([^"]+)"', text, re.MULTILINE):
        keys.append(m.group(1))
    return keys


def parse_blender_keys(text):
    keys = []
    in_floors = False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("FLOORS = ["):
            in_floors = True
            continue
        if in_floors:
            if s == "]":
                break
            m = re.match(r'\s*\(\s*"([^"]+)"', line)
            if m:
                keys.append(m.group(1))
    return keys


def parse_model_slots(text):
    slots = []
    in_models = False
    for line in text.splitlines():
        if "export const MODELS:" in line:
            in_models = True
            continue
        if in_models:
            if line.strip() == "};":
                break
            m = re.match(r'\s+"([^"]+)":', line)
            if m:
                slots.append(m.group(1))
    return slots


def parse_floor_key_map(text: str) -> set[str]:
    """Extract the canonical Floor.key values from the FLOOR_KEY_MAP dict."""
    keys: set[str] = set()
    # Match lines like:  "reclamation-core": "basement",
    for line in text.splitlines():
        m = re.match(r'\s*["\']([\w-]+)["\']\s*:\s*["\']', line)
        if m:
            keys.add(m.group(1))
    return keys


NEED_TO_FLOORS = {
    "parking":     ["parking-p1"],
    "water":       ["reclamation-core"],
    "energy":      ["power-ops-core"],
    "food":        ["aquaponics-bay", "vertical-farm"],
    "shelter":     ["residences-a", "residences-b", "residences-c",
                    "residences-d", "penthouses"],
    "air":         ["the-lung"],
    "health":      ["commons-clinic"],
    "restoration": ["skydeck-reservoir"],
}

BLENDER_ONLY = {"basement", "rooftop"}

MODEL_ONLY = {"rooftopProp"}


def main():
    parser = argparse.ArgumentParser(description="ATLAS naming alignment validator")
    parser.add_argument("--strict", action="store_true",
                        help="Warn about known one-to-many mappings")
    args = parser.parse_args()

    seed_text = SEED_FILE.read_text()
    blender_text = BLENDER_FILE.read_text()
    models_text = MODELS_FILE.read_text()

    seed_keys = parse_seed_keys(seed_text)
    blender_keys = parse_blender_keys(blender_text)
    model_slots = parse_model_slots(models_text)

    seed_to_need = {}
    for need, floors in NEED_TO_FLOORS.items():
        for f in floors:
            seed_to_need[f] = need

    all_seed = set(seed_keys)
    all_blender = set(blender_keys)
    all_models = set(model_slots)

    mismatches = []

    # Header
    bar = "=" * 78
    print(bar)
    print("ATLAS NAMING ALIGNMENT VALIDATOR")
    print(bar)

    print(f"\n{'Source':<30} {'Count':<6} Keys")
    print("-" * 78)
    print(f"{'Data model (seedFloors)':<30} {len(seed_keys):<6} {', '.join(seed_keys)}")
    print(f"{'Blender (FLOORS)':<30} {len(blender_keys):<6} {', '.join(blender_keys)}")
    print(f"{'models.ts (MODELS)':<30} {len(model_slots):<6} {', '.join(model_slots)}")

    # Per-seed-key cross-reference
    print(f"\n{'Seed key':<25} {'Need':<15} {'Blender?':<10} {'models.ts?':<12} Notes")
    print("-" * 78)

    for sk in sorted(all_seed):
        need = seed_to_need.get(sk, "???")
        in_blender = need in all_blender
        in_models = f"floor-{sk}" in all_models or f"floor-{need}" in all_models

        notes = []
        if not in_blender:
            notes.append("NO BLENDER MODEL")
        if not in_models:
            notes.append("NO MODEL SLOT")

        print(f"{sk:<25} {need:<15} {'YES' if in_blender else 'NO':<10} "
              f"{'YES' if in_models else 'NO':<12} {'; '.join(notes)}")

        if notes:
            mismatches.append((sk, notes))

    # Blender keys not in the mapping
    for bk in sorted(all_blender):
        if bk not in NEED_TO_FLOORS and bk not in BLENDER_ONLY:
            msg = f"Blender key '{bk}' has no data-model counterpart"
            print(f"\n  MISMATCH: {msg}")
            mismatches.append((bk, [msg]))
        elif bk in NEED_TO_FLOORS:
            mapped = NEED_TO_FLOORS[bk]
            for fk in mapped:
                if fk not in all_seed:
                    msg = f"Blender '{bk}' maps to seed key '{fk}' which is NOT in seed data"
                    print(f"\n  MISMATCH: {msg}")
                    mismatches.append((bk, [msg]))

    # Build set of all GLB filenames the Blender pipeline exports (from FLOOR_KEY_MAP)
    floor_key_map = parse_floor_key_map(blender_text)
    exported_glbs = set(f"floor-{k}" for k in floor_key_map)

    # Model slots that don't map back
    for ms in sorted(all_models):
        if ms in MODEL_ONLY:
            continue
        if ms.startswith("floor-"):
            suffix = ms.removeprefix("floor-")
            # Two valid paths:
            # 1. Can be a canonical data-model key (floor-reclamation-core) — check seed data
            # 2. Can be a legacy need-based key (floor-water) — check Blender FLOORS
            # Either is valid if the GLB is exported by the pipeline
            in_exports = ms in exported_glbs
            in_seed = suffix in all_seed
            in_blender_need = suffix in all_blender

            if not in_exports:
                if not in_seed and not in_blender_need:
                    msg = f"Model slot '{ms}' has no Blender export and no data-model key"
                    print(f"\n  MISMATCH: {msg}")
                    mismatches.append((ms, [msg]))
                elif in_seed:
                    # Canonical key exists in seed data but Blender FLOOR_KEY_MAP missing — warn
                    msg = f"Model slot '{ms}' is a canonical data-model key but Blender FLOOR_KEY_MAP missing it"
                    print(f"\n  MISMATCH: {msg}")
                    mismatches.append((ms, [msg]))
            elif in_exports and in_seed:
                pass  # canonical key, exported — ideal
            elif in_exports and in_blender_need:
                pass  # legacy need-based key, exported — fine

    # Strict: warn about one-to-many
    if args.strict:
        print("\n--- Strict: one-to-many mappings ---")
        for need, floors in NEED_TO_FLOORS.items():
            if len(floors) > 1:
                print(f"  Blender '{need}' → {len(floors)} data floors: {', '.join(floors)}")

    # Summary
    print()
    print(bar)
    total = len(mismatches)
    if total == 0:
        print("RESULT: PASS — all keys aligned")
        sys.exit(0)
    else:
        print(f"RESULT: FAIL — {total} mismatch(es) detected")
        for key, notes in mismatches:
            print(f"  · {key}: {'; '.join(notes)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
