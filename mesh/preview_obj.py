import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa

OBJ = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\scripts_re_sessao\brachio_combined.obj"

objects = {}  # name -> list of (x,y,z)
cur = None
verts_global = []

with open(OBJ) as f:
    for line in f:
        line = line.strip()
        if line.startswith("o "):
            cur = line[2:].strip()
            objects[cur] = []
        elif line.startswith("v "):
            _, x, y, z = line.split()
            p = (float(x), float(y), float(z))
            verts_global.append(p)
            objects[cur].append(p)

colors = plt.cm.tab10.colors

fig = plt.figure(figsize=(16, 8))
ax1 = fig.add_subplot(121, projection='3d')
for i, (name, pts) in enumerate(objects.items()):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; zs = [p[2] for p in pts]
    ax1.scatter(xs, ys, zs, s=3, color=colors[i % 10], label=name)
ax1.set_title("Combined (raw local frames, no alignment)")
ax1.legend(fontsize=7)

ax2 = fig.add_subplot(122)
for i, (name, pts) in enumerate(objects.items()):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    ax2.scatter(xs, ys, s=3, color=colors[i % 10], label=name)
ax2.set_title("Combined XY projection")
ax2.set_aspect('equal')
ax2.legend(fontsize=7)

plt.tight_layout()
out = r"C:\Users\Matheus\Documents\Jurassic park builder\Arquivo extra\scripts_re_sessao\combined_preview.png"
plt.savefig(out, dpi=120)
print("saved", out)
print("total verts:", len(verts_global))
for name, pts in objects.items():
    print(name, len(pts))
