#!/usr/bin/env python3
"""Fix all curly apostrophes in write_postman_detailed.js"""

with open('write_postman_detailed.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace curly apostrophes with straight ones
content = content.replace(''', "'")
content = content.replace(''', "'")

with open('write_postman_detailed.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed all curly apostrophes!")
