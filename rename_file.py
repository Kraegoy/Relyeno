import os

folder = r"ezgif-87fb139ab9c3612d-jpg"  # change to your actual folder path
start  = 153

files = sorted([f for f in os.listdir(folder) if f.endswith(".jpg")])

for i, filename in enumerate(files):
    new_name = f"ezgif-frame-{start + i:03d}.jpg"
    os.rename(
        os.path.join(folder, filename),
        os.path.join(folder, new_name)
    )
    print(f"{filename} → {new_name}")

print("Done.")