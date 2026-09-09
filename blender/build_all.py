"""Headless orchestrator: rebuilds every .glb the runtime needs.

    /Applications/Blender.app/Contents/MacOS/Blender -b --python build_all.py

Each group is built into a freshly emptied scene and exported on its own, so
the three files stay independent and the build is idempotent — running it twice
produces byte-comparable assets.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))
sys.path.insert(0, HERE)

import bpy  # noqa: E402

import meshutil as U  # noqa: E402

OUT = os.path.normpath(os.path.join(HERE, "..", "web", "public", "models"))

GROUPS = ("table", "quad", "objects")


def stats(objects):
    tris = verts = 0
    for o in objects:
        if o.type != "MESH":
            continue
        me = o.data
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        verts += len(me.vertices)
    return verts, tris


def run_group(name):
    U.reset_scene()
    module = __import__("build_" + name)
    objects = module.build()
    path = os.path.join(OUT, name + ".glb")
    U.export_glb(path, objects)
    v, t = stats(objects)
    size = os.path.getsize(path)
    print("BUILT %-8s objects=%-2d verts=%-7d tris=%-7d %6.1f KB  %s"
          % (name, len(objects), v, t, size / 1024.0,
             ", ".join(o.name for o in objects[:4])
             + (" ..." if len(objects) > 4 else "")))
    return size, t


def main():
    os.makedirs(OUT, exist_ok=True)
    total_size = total_tris = 0
    for g in GROUPS:
        s, t = run_group(g)
        total_size += s
        total_tris += t
    print("TOTAL %.1f KB across %d files, %d tris"
          % (total_size / 1024.0, len(GROUPS), total_tris))
    print("BUILD_OK")


if __name__ == "__main__":
    main()
