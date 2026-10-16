# Genera las variantes panoramicas (.pano.webp) de los 8 submundos.
import subprocess, glob, os, sys, time
PY = r".sam-venv/Scripts/python.exe"
for src in sorted(glob.glob(r"assets/submundos/*/submundo*.webp")):
    if ".pano" in src or ".169" in src or "/old/" in src.replace("\\","/"):
        continue
    dst = src.replace(".webp", ".pano.webp")
    t = time.time()
    print(">>>", src, flush=True)
    r = subprocess.run([PY, "tools/quilt_extend.py", src, dst, "--ratio", "2.35"],
                       capture_output=True, text=True)
    print(r.stdout.strip(), r.stderr.strip()[-300:] if r.returncode else "",
          f"({time.time()-t:.0f}s)", flush=True)
print("done")
