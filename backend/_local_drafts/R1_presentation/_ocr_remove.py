"""Cover listing_rules, allowed_rules, prohibited_rules in User entity box.

OCR found these as separate column rows in the User table:
  row 1: listing_rules   (approx y=42-54, right side of entity)
  row 2: allowed_rules    (approx y=79-93, right side) — OCR split: 'alewed' + 'cules'
  row 3: prohibited_rules (approx y=93-106, right side)

Each row has: @ column_name : TYPE — we cover the entire row from x=990 to x=1100.
"""
from PIL import Image, ImageDraw

img = Image.open("er_diagram.png")
draw = ImageDraw.Draw(img)
bg = (250, 250, 250, 255)

# Cover the three rows — wide enough to include @ symbol and type annotation
# Each row: x=985 to x=1105, with a few pixels padding

rows_to_cover = [
    (985, 38, 1105, 56),   # listing_rules row
    (985, 76, 1105, 93),   # allowed_rules row
    (985, 91, 1105, 108),  # prohibited_rules row
]

for x1, y1, x2, y2 in rows_to_cover:
    draw.rectangle([x1, y1, x2, y2], fill=bg)
    print(f"  Covered rect ({x1},{y1})-({x2},{y2})")

img.save("er_diagram.png")
print("Saved er_diagram.png")
