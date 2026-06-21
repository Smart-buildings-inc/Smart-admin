#!/usr/bin/env python3
"""
pipeline.py — ATLAS Build → Bake → Export Pipeline (Single Entry Point)
=======================================================================

Orchestrates the full asset pipeline with CLI flags, progress tracking,
error recovery, GLB optimization (Draco + JPEG), and validation.

Usage:
  blender --background --python pipeline.py -- [flags]

Flags:
  --bake-only       Skip build, just bake existing scene
  --export-only     Skip build+bake, just export GLBs
  --render-only     Just render PNGs from existing .blend
  --floor KEY       Only process one floor (fast dev iteration)
  --no-bake         Skip texture baking (fast, flat materials)
  --no-anim         Skip animation creation
  --quality high    Use 2048px textures (vs default 512px tiered)
  --quality low     Use 256px max textures (fast, small GLBs)
  --help            Show this message
"""

import os
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# ── Blender is the host — guaranteed available ──
import bpy
from mathutils import Vector

# ═══════════════════════════════════════════════════════════════════════════
# 1. ANIMATION FIX — Blender 4.5+ NLA action_slot.target_id_type
# ═══════════════════════════════════════════════════════════════════════════
# In Blender 4.5 the action-slot API replaced the old slot system. Actions
# without a properly-typed slot crash the glTF exporter and can cause NLA
# strip validation errors. We patch _create_action before any caller uses it.

BLENDER_VER = bpy.app.version  # tuple e.g. (4, 5, 0)
BLENDER_VER_STR = bpy.app.version_string


def _patch_animation_module():
    """Monkey-patch animations._create_action for Blender >= 4.5."""
    if BLENDER_VER < (4, 5, 0):
        return

    # Import the animations module before build_atlas_floors does
    anim_path = os.path.join(HERE, "animations.py")
    if not os.path.exists(anim_path):
        print("[PIPELINE] animations.py not found — skipping NLA patch")
        return

    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location("animations", anim_path)
        animations = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(animations)
    except Exception as e:
        print(f"[PIPELINE] Could not pre-load animations: {e}")
        return

    _original = animations._create_action

    def _create_action_v45(obj, name, start=1, end=60):
        if obj.animation_data is None:
            obj.animation_data_create()

        action = bpy.data.actions.new(name=f"ANIM_{name}")
        action.use_fake_user = True

        # Blender 4.5 requires action slots to be explicitly created
        if hasattr(action, "slots"):
            slot = action.slots.new("OBJECT")
            try:
                slot.target_id_type = "OBJECT"
            except Exception:
                pass

        track = obj.animation_data.nla_tracks.new()
        track.name = name
        strip = track.strips.new(action.name, start, action)
        strip.name = name

        return action

    animations._create_action = _create_action_v45
    sys.modules["animations"] = animations
    print(f"[PIPELINE] Patched _create_action for Blender {BLENDER_VER_STR}")


_patch_animation_module()

# ═══════════════════════════════════════════════════════════════════════════
# 2. CLI ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════

def _parse_args():
    """Parse CLI flags with argparse; fall back to manual parsing if needed."""
    try:
        import argparse
    except ImportError:
        return _parse_args_manual()

    parser = argparse.ArgumentParser(
        description="ATLAS Build → Bake → Export Pipeline",
        add_help=False,
    )
    parser.add_argument("--bake-only", action="store_true")
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--render-only", action="store_true")
    parser.add_argument("--floor", type=str, default=None)
    parser.add_argument("--no-bake", action="store_true")
    parser.add_argument("--no-anim", action="store_true")
    parser.add_argument("--quality", type=str, default="auto",
                        choices=["high", "low", "auto"])
    parser.add_argument("--help", action="store_true")

    try:
        idx = sys.argv.index("--")
        args = parser.parse_args(sys.argv[idx + 1:])
    except ValueError:
        args = parser.parse_args([])

    if args.help:
        print(__doc__)
        parser.print_help()
        sys.exit(0)

    return args


def _parse_args_manual():
    """Fallback manual argument parser (no argparse dependency)."""
    args = type("Args", (), {
        "bake_only": False, "export_only": False, "render_only": False,
        "floor": None, "no_bake": False, "no_anim": False,
        "quality": "auto", "help": False,
    })()

    argv = sys.argv
    try:
        idx = argv.index("--")
        argv = argv[idx + 1:]
    except ValueError:
        return args

    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--bake-only":
            args.bake_only = True
        elif a == "--export-only":
            args.export_only = True
        elif a == "--render-only":
            args.render_only = True
        elif a == "--no-bake":
            args.no_bake = True
        elif a == "--no-anim":
            args.no_anim = True
        elif a == "--quality":
            i += 1
            if i < len(argv):
                args.quality = argv[i]
        elif a == "--floor":
            i += 1
            if i < len(argv):
                args.floor = argv[i]
        elif a == "--help":
            args.help = True
        i += 1

    if args.help:
        print(__doc__)
        sys.exit(0)
    return args


# ═══════════════════════════════════════════════════════════════════════════
# 3. PROGRESS TRACKER
# ═══════════════════════════════════════════════════════════════════════════

class Progress:
    def __init__(self, total_steps):
        self.total = total_steps
        self.steps = []
        self.total_s = time.time()

    def begin(self, label):
        t0 = time.time()
        self.steps.append((label, t0, None, None))
        return t0

    def end(self, ok=True, detail=None):
        if not self.steps:
            return
        label, t0, _, _ = self.steps[-1]
        elapsed = time.time() - t0
        self.steps[-1] = (label, t0, elapsed, ok)
        status = "\u2713" if ok else "\u2717"
        detail_str = f" {detail}" if detail else ""
        print(f"[{len(self.steps)}/{self.total}] {label:<38} {status} {elapsed:.1f}s{detail_str}")

    def summary(self, **counts):
        elapsed = time.time() - self.total_s
        parts = ", ".join(f"{v} {k}" for k, v in sorted(counts.items()))
        print(f"\n  TOTAL: {elapsed:.0f}s  ({parts})")


# ═══════════════════════════════════════════════════════════════════════════
# 4. GLB EXPORT (Draco + JPEG optimized)
# ═══════════════════════════════════════════════════════════════════════════

def export_glb_optimized(col, key, models_dir, draco_level=6):
    """
    Export a floor collection to GLB with Draco mesh compression and
    JPEG texture encoding for minimal file size.
    Falls back to standard export if features are unavailable.
    """
    bpy.ops.object.select_all(action="DESELECT")
    for o in col.all_objects:
        o.select_set(True)

    path = os.path.join(models_dir, f"floor-{key}.glb")

    kwargs = {
        "filepath": path,
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_yup": True,
        "export_animations": False,
    }

    # Phase 1 — try full optimization (Draco + JPEG)
    if not _try_optimized_export(kwargs, draco_level):
        # Phase 2 — fallback without optimization
        try:
            bpy.ops.export_scene.gltf(**kwargs)
        except Exception as e:
            raise RuntimeError(f"GLB export failed for {key}: {e}") from e

    sz = os.path.getsize(path) if os.path.exists(path) else 0
    print(f"  GLB {key}: {sz/1024:.1f} KB -> {os.path.basename(path)}")
    return path, sz


def _try_optimized_export(base_kwargs, draco_level):
    """Try exporting with Draco + JPEG; return True on success."""
    opt_kwargs = dict(base_kwargs)
    opt_kwargs["export_draco_mesh_compression_enable"] = True
    opt_kwargs["export_draco_mesh_compression_level"] = draco_level
    # JPEG for textures (may be absent in some Blender versions)
    opt_kwargs["export_image_format"] = "JPEG"

    try:
        bpy.ops.export_scene.gltf(**opt_kwargs)
        return True
    except (TypeError, AttributeError):
        # Draco or image_format param not available — try Draco-only
        opt_kwargs.pop("export_image_format", None)
        try:
            bpy.ops.export_scene.gltf(**opt_kwargs)
            return True
        except (TypeError, AttributeError):
            opt_kwargs.pop("export_draco_mesh_compression_enable", None)
            opt_kwargs.pop("export_draco_mesh_compression_level", None)
            try:
                bpy.ops.export_scene.gltf(**opt_kwargs)
                return True
            except Exception:
                return False
    except Exception:
        return False


def _export_size_comparison(before_path, after_path):
    """Print before/after size comparison if both files exist."""
    if not before_path or not after_path:
        return
    if not os.path.exists(before_path) or not os.path.exists(after_path):
        return
    b_sz = os.path.getsize(before_path)
    a_sz = os.path.getsize(after_path)
    if b_sz == 0:
        return
    pct = (a_sz / b_sz) * 100
    saved = b_sz - a_sz
    sign = "-" if saved >= 0 else "+"
    print(f"    Size: {b_sz/1024:.1f} KB -> {a_sz/1024:.1f} KB "
          f"({sign}{abs(saved)/1024:.1f} KB, {pct:.0f}%)")


# ═══════════════════════════════════════════════════════════════════════════
# 5. GLB VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

GLB_MAGIC = b"glTF"


def validate_glb(filepath):
    """Check GLB exists, has content, and starts with valid magic bytes."""
    if not os.path.exists(filepath):
        return ["MISSING"]
    sz = os.path.getsize(filepath)
    if sz == 0:
        return ["ZERO_BYTES"]
    try:
        with open(filepath, "rb") as f:
            magic = f.read(4)
        if magic != GLB_MAGIC:
            return [f"BAD_MAGIC: {magic.hex()}"]
    except OSError as e:
        return [f"READ_ERROR: {e}"]
    return ["OK"]


def validate_all_glbs(models_dir, expected_keys):
    """Validate every exported GLB and print a size/health report."""
    print(f"\n{'='*60}")
    print("GLB VALIDATION")
    print(f"{'='*60}")

    sizes = {}
    errors = {}
    flagged = []

    for key in sorted(expected_keys):
        path = os.path.join(models_dir, f"floor-{key}.glb")
        result = validate_glb(path)
        sz = os.path.getsize(path) if os.path.exists(path) else 0
        sizes[key] = sz

        ok = result == ["OK"]
        status = "\u2713" if ok else "\u2717"
        err_str = f"  {' '.join(result)}" if not ok else ""
        print(f"  {status} {key:<24} {sz/1024:>8.1f} KB{err_str}")

        if not ok:
            errors[key] = result
        if sz > 2 * 1024 * 1024:
            flagged.append(key)

    if sizes:
        valid = {k: v for k, v in sizes.items() if k not in errors}
        if valid:
            vals = list(valid.values())
            print(f"\n  Size stats ({len(valid)} valid GLBs):")
            print(f"    Min:    {min(vals)/1024:.1f} KB")
            print(f"    Max:    {max(vals)/1024:.1f} KB")
            print(f"    Avg:    {sum(vals)/len(vals)/1024:.1f} KB")
            print(f"    Total:  {sum(vals)/(1024*1024):.2f} MB")

    if flagged:
        print(f"\n  \u26a0 {len(flagged)} floor(s) > 2 MB: {', '.join(flagged)}")

    if errors:
        print(f"\n  \u2717 {len(errors)} invalid GLB(s):")
        for k, e in sorted(errors.items()):
            print(f"    {k}: {', '.join(e)}")

    return len(errors) == 0, sizes


# ═══════════════════════════════════════════════════════════════════════════
# 6. PIPELINE ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════

def main():
    args = _parse_args()

    # ── Resolve mode ──
    mode_flags = [args.bake_only, args.export_only, args.render_only]
    if sum(mode_flags) > 1:
        print("ERROR: --bake-only, --export-only, --render-only are mutually exclusive")
        sys.exit(1)

    if args.bake_only:
        do_build = False
        do_bake = True
        do_render = False
        do_export = False
    elif args.export_only:
        do_build = False
        do_bake = False
        do_render = False
        do_export = True
    elif args.render_only:
        do_build = False
        do_bake = False
        do_render = True
        do_export = False
    else:
        do_build = True
        do_bake = not args.no_bake
        do_render = True
        do_export = True

    do_anim = not args.no_anim

    # ── Quality ──
    quality_labels = {"high": 4.0, "low": 0.5, "auto": 1.0}
    quality_mult = quality_labels.get(args.quality, 1.0)

    # ── Floor filter ──
    floor_filter = args.floor

    # ── Header ──
    mode_name = ("full" if do_build else
                 "bake-only" if args.bake_only else
                 "export-only" if args.export_only else
                 "render-only")
    print(f"\n{'#'*68}")
    print(f"  ATLAS PIPELINE  |  Blender {BLENDER_VER_STR}")
    print(f"  Mode: {mode_name}  |  Quality: {args.quality} ({quality_mult}x)"
          f"  |  Floor: {floor_filter or 'all'}")
    print(f"  Anim: {'on' if do_anim else 'off'}  |  "
          f"Bake: {'on' if do_bake else 'off'}")
    print(f"{'#'*68}\n")

    # ── Import build modules (after animation patch is applied) ──
    import build_atlas_floors as baf

    # Override globals BEFORE they are read by helper functions
    baf.BAKE_ENABLED = do_bake
    baf.ANIM_ENABLED = do_anim

    from build_atlas_floors import (
        FLOORS, FLOOR_KEY_MAP, BUILDERS, MODELS_DIR, RENDERS_DIR,
        BAKE_DIR, BAKE_BUDGET_MB, collection,
        build_module, world_and_render_setup, add_sun,
        make_cam, render_module, render_hero, _BULB_WATTAGE,
    )

    if do_anim:
        from animations import animate_floor

    if do_bake:
        from bake_pipeline import BakeSession, clear_baked_textures
        import bake_pipeline as bp

    # ── Which floors to process ──
    builder_keys = set(FLOOR_KEY_MAP.values())
    active_floors = [(k, l, a) for k, l, a in FLOORS if k in builder_keys]
    if floor_filter:
        active_floors = [f for f in active_floors if f[0] == floor_filter]
        if not active_floors:
            available = sorted(set(f[0] for f in FLOORS if f[0] in builder_keys))
            print(f"ERROR: Unknown floor '{floor_filter}'. Available: {available}")
            sys.exit(1)

    # ── Calculate total steps for progress bar ──
    total_steps = (int(do_build) + int(do_anim) + int(do_render) +
                   int(do_bake) + int(do_export) + int(do_export))
    progress = Progress(total_steps)

    # ── Discover existing collections for skip modes ──
    builder_cols = {}
    modules = []

    if not do_build:
        for key, label, accent in active_floors:
            col = bpy.data.collections.get(f"Floor_{key}")
            if col:
                builder_cols[key] = col
                modules.append((key, label, accent))
            else:
                print(f"  WARNING: Floor_{key} not found in scene")
    # ── else: do_build creates them below ──

    # ═══════════════════════════════════════════════════════════════════
    # STEP: BUILD
    # ═══════════════════════════════════════════════════════════════════
    build_failures = []
    if do_build:
        progress.begin("Building floor modules")
        t0 = time.time()
        for key, label, accent in active_floors:
            try:
                col = build_module(key, label, accent)
                builder_cols[key] = col
                modules.append((key, label, accent))
            except Exception:
                build_failures.append(key)
                print(f"  \u2717 BUILD FAILED for {key}")
                traceback.print_exc()
        elapsed = time.time() - t0
        detail = f"{len(modules)} floors in {elapsed:.1f}s"
        progress.end(ok=len(build_failures) == 0, detail=detail)
        if build_failures:
            print(f"  Skipped: {build_failures}")
    else:
        print("[SKIP] Building (--bake-only / --export-only / --render-only)")

    # ═══════════════════════════════════════════════════════════════════
    # STEP: ANIMATIONS
    # ═══════════════════════════════════════════════════════════════════
    anim_failures = []
    if do_anim and modules:
        progress.begin("Adding animations")
        t0 = time.time()
        for key, _, _ in modules:
            try:
                animate_floor(builder_cols[key], key)
            except Exception:
                anim_failures.append(key)
                print(f"  \u2717 ANIM FAILED for {key}")
                traceback.print_exc()
        elapsed = time.time() - t0
        anim_count = len(modules) - len(anim_failures)
        progress.end(ok=len(anim_failures) == 0,
                      detail=f"{anim_count} floors in {elapsed:.1f}s")
    elif not do_anim:
        print("[SKIP] Animations (--no-anim)")

    # ═══════════════════════════════════════════════════════════════════
    # STEP: RENDER
    # ═══════════════════════════════════════════════════════════════════
    render_failures = []
    render_count = 0
    if do_render and modules:
        progress.begin("Rendering marketing stills")
        t0 = time.time()
        try:
            world_and_render_setup()
            add_sun()
            cam = make_cam()
            for key, _, _ in modules:
                try:
                    render_module(cam, key)
                    render_count += 1
                except Exception:
                    render_failures.append(key)
                    print(f"  \u2717 RENDER FAILED for {key}")
                    traceback.print_exc()
            if len(modules) > 1 and len(render_failures) == 0:
                try:
                    render_hero(cam, modules)
                    render_count += 1
                except Exception:
                    print(f"  \u2717 HERO RENDER FAILED")
                    traceback.print_exc()
            elapsed = time.time() - t0
            progress.end(ok=len(render_failures) == 0,
                          detail=f"{render_count} renders in {elapsed:.1f}s")
        except Exception:
            elapsed = time.time() - t0
            progress.end(ok=False, detail="setup failed")
            traceback.print_exc()
    elif not do_render:
        print("[SKIP] Rendering")

    # ── Save procedural .blend (protect work) ──
    if do_build or do_anim:
        blend_proc = os.path.join(HERE, "atlas_floors.blend")
        try:
            bpy.ops.wm.save_as_mainfile(filepath=blend_proc)
            print(f"  SAVED {os.path.basename(blend_proc)}")
        except Exception:
            print(f"  \u2717 SAVE FAILED for {os.path.basename(blend_proc)}")

    # ═══════════════════════════════════════════════════════════════════
    # STEP: BAKE
    # ═══════════════════════════════════════════════════════════════════
    bake_failures = []
    baked_count = 0
    total_bake_kb = 0
    if do_bake and modules:
        progress.begin("Baking PBR textures")
        t0 = time.time()

        if not do_build:
            clear_baked_textures(BAKE_DIR)

        # Override resolution tiers for --quality
        _orig_large = bp.RES_LARGE
        _orig_medium = bp.RES_MEDIUM
        _orig_small = bp.RES_SMALL
        _orig_orm = bp.RES_ORM
        bp.RES_LARGE = max(64, int(_orig_large * quality_mult))
        bp.RES_MEDIUM = max(64, int(_orig_medium * quality_mult))
        bp.RES_SMALL = max(32, int(_orig_small * quality_mult))
        bp.RES_ORM = max(16, int(_orig_orm * quality_mult))

        print(f"  Resolution: L={bp.RES_LARGE} M={bp.RES_MEDIUM} "
              f"S={bp.RES_SMALL} ORM={bp.RES_ORM}")

        for key, _, _ in modules:
            try:
                col = builder_cols[key]
                session = BakeSession(output_dir=BAKE_DIR)
                session.bake_floor(col)
                session.replace_materials_with_baked(col)
                total_bake_kb += session.total_size_kb
                baked_count += 1
            except Exception:
                bake_failures.append(key)
                print(f"  \u2717 BAKE FAILED for {key}")
                traceback.print_exc()

        # Restore
        bp.RES_LARGE = _orig_large
        bp.RES_MEDIUM = _orig_medium
        bp.RES_SMALL = _orig_small
        bp.RES_ORM = _orig_orm

        elapsed = time.time() - t0
        mat_count = baked_count  # proxy; real count is in session output
        progress.end(ok=len(bake_failures) == 0,
                      detail=f"{baked_count} floors in {elapsed:.1f}s")

        # Save baked .blend
        blend_baked = os.path.join(HERE, "atlas_floors_baked.blend")
        try:
            bpy.ops.wm.save_as_mainfile(filepath=blend_baked)
            print(f"  SAVED {os.path.basename(blend_baked)}")
        except Exception:
            print(f"  \u2717 SAVE FAILED for {os.path.basename(blend_baked)}")
    elif not do_bake:
        print("[SKIP] Baking (--no-bake)")

    # ═══════════════════════════════════════════════════════════════════
    # STEP: EXPORT GLBs
    # ═══════════════════════════════════════════════════════════════════
    export_failures = []
    export_count = 0
    total_glb_bytes = 0
    if do_export and modules:
        progress.begin("Exporting GLB assets")
        t0 = time.time()

        for dm_key, builder_key in FLOOR_KEY_MAP.items():
            if builder_key not in builder_cols:
                continue
            if floor_filter and builder_key != floor_filter:
                continue
            try:
                path, sz = export_glb_optimized(
                    builder_cols[builder_key], dm_key, MODELS_DIR)
                total_glb_bytes += sz
                export_count += 1
            except Exception:
                export_failures.append((dm_key, str(sys.exc_info()[1])))
                print(f"  \u2717 EXPORT FAILED for {dm_key}")
                traceback.print_exc()

        elapsed = time.time() - t0
        detail = f"{export_count} GLBs in {elapsed:.1f}s"
        progress.end(ok=len(export_failures) == 0, detail=detail)
    elif not do_export:
        print("[SKIP] Exporting")

    # ═══════════════════════════════════════════════════════════════════
    # STEP: VALIDATION + BUDGET CHECK
    # ═══════════════════════════════════════════════════════════════════
    if do_export and modules:
        progress.begin("Budget verification")
        export_keys = [k for k, bk in FLOOR_KEY_MAP.items()
                       if bk in builder_cols
                       and (not floor_filter or bk == floor_filter)]
        all_valid, sizes = validate_all_glbs(MODELS_DIR, export_keys)

        if sizes:
            total_mb = sum(sizes.values()) / (1024 * 1024)
            budget_mb = BAKE_BUDGET_MB if do_bake else 2.5
            pct = (total_mb / budget_mb) * 100 if budget_mb > 0 else 0
            budget_ok = total_mb <= budget_mb
            detail = (f"{total_mb:.1f} MB ({pct:.0f}% of {budget_mb:.1f} MB "
                      f"{'budget' if do_bake else 'flat budget'})")
            progress.end(ok=budget_ok, detail=detail)
            if not budget_ok:
                over = total_mb - budget_mb
                print(f"  \u26a0 OVER BUDGET by {over:.2f} MB")
        else:
            progress.end(ok=False, detail="no valid GLBs")
    else:
        print("[SKIP] Budget verification (no exports)")

    # ═══════════════════════════════════════════════════════════════════
    # FINAL SUMMARY
    # ═══════════════════════════════════════════════════════════════════
    built = len(modules) - len(build_failures)
    print(f"\n{'='*60}")
    print(f"  PIPELINE COMPLETE  —  {BLENDER_VER_STR}")
    print(f"  {built}/{len(active_floors)} floors built, "
          f"{baked_count}/{len(modules)} baked, "
          f"{export_count}/{len(modules)} exported")
    if export_failures:
        print(f"  Export failures ({len(export_failures)}):")
        for k, err in export_failures:
            print(f"    {k}: {err}")
    if bake_failures:
        print(f"  Bake failures ({len(bake_failures)}): {', '.join(bake_failures)}")
    if build_failures:
        print(f"  Build failures ({len(build_failures)}): {', '.join(build_failures)}")

    progress.summary(
        floors_built=f"{built}/{len(active_floors)}",
        floors_baked=f"{baked_count}/{len(modules)}",
        glbs_exported=f"{export_count}",
        renders=f"{render_count}",
    )
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
