"""Extract entity boxes from ER diagram and save as individual crops.

This helps the user identify which box is 'listing_rules' so we can remove it.
"""
from PIL import Image
import os

img = Image.open("er_diagram.png")
w, h = img.size
bg = (250, 250, 250, 255)

# Find entity boxes by looking for horizontal color bands (header bars)
# then expanding to full bounding boxes.

# Step 1: find all rows that contain an entity header color stripe
header_rows = []
for y in range(0, h, 2):
    row_colors = set()
    for x in range(0, w, 5):
        p = img.getpixel((x, y))
        if p[3] == 0:
            continue
        # Skip bg and white
        if p == bg or (p[0] > 248 and p[1] > 248 and p[2] > 248):
            continue
        row_colors.add((p[0], p[1], p[2]))
    if row_colors:
        header_rows.append(y)

# Step 2: identify entity bounding boxes by finding contiguous colored
# regions and their boundaries
# Strategy: for each contiguous band of non-bg rows, find the min/max x bounds

# Group rows into blocks separated by all-white rows
blocks = []
in_block = False
block_start = 0
for y in header_rows:
    if not in_block:
        block_start = y
        in_block = True
    # if gap > 8 rows, end block
    if in_block and y - header_rows[header_rows.index(y)-1] > 8 if header_rows.index(y) > 0 else False:
        pass  # keep going

# Simpler: group by continuity
groups = []
group_start = header_rows[0]
prev = header_rows[0]
for y in header_rows[1:]:
    if y - prev > 8:
        groups.append((group_start, prev))
        group_start = y
    prev = y
groups.append((group_start, prev))

print(f"Found {len(groups)} entity groups")
cropped_dir = "entity_crops"
os.makedirs(cropped_dir, exist_ok=True)

for i, (top, bot) in enumerate(groups):
    # Find the horizontal bounds for this entity
    min_x = w
    max_x = 0
    for y in range(top, bot + 1, 2):
        for x in range(0, w, 2):
            p = img.getpixel((x, y))
            if p[3] > 0 and p != bg and not (p[0] > 248 and p[1] > 248 and p[2] > 248):
                min_x = min(min_x, x)
                max_x = max(max_x, x)
    
    # Expand bounds a bit
    min_x = max(0, min_x - 10)
    max_x = min(w, max_x + 10)
    top_e = max(0, top - 5)
    bot_e = min(h, bot + 5)
    
    crop = img.crop((min_x, top_e, max_x, bot_e))
    
    # Skip tiny crops
    if (max_x - min_x) < 50 or (bot_e - top_e) < 20:
        continue
    
    fname = f"{cropped_dir}/entity_{i:02d}_y{top_e}-{bot_e}_x{min_x}-{max_x}.png"
    crop.save(fname)
    # Sample header color
    header_color = None
    for sx in range(min_x + 20, max_x, 30):
        p = img.getpixel((sx, top + 5))
        if p[3] > 0 and not (p[0] > 248 and p[1] > 248 and p[2] > 248):
            header_color = f"RGB({p[0]},{p[1]},{p[2]})"
            break
    print(f"  entity {i:02d}: y={top_e}-{bot_e} x={min_x}-{max_x} header={header_color} -> {fname}")
