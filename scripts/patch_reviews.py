#!/usr/bin/env python3
"""Patch the Reviews section in write_postman_detailed.js"""

# Read the file
with open('write_postman_detailed.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# New review endpoints to insert
new_endpoints = """    },
    {
      name: 'Create Review for Listing',
      method: 'POST',
      path: '/reviews',
      body: { reviewedListingId: '6501abcdef1234567890abcd', rating: 5, text: 'Great product, fast shipping!' },
      description: describe(
        'Creates a review for a listing. Updates the listing\\'s aggregate rating and ratingCount.',
        fmt({ reviewedListingId: '6501abcdef1234567890abcd', rating: 5, text: 'Great product, fast shipping!' }),
        fmt({ review: { _id: '6506...', reviewerId: '64fd...', reviewedListingId: '6501...', rating: 5, text: { en: 'Great product, fast shipping!', ar: '' } } })
      ),
    },
    {
      name: 'Create Review for Request',
      method: 'POST',
      path: '/reviews',
      body: { reviewedRequestId: '6502abcdef1234567890abcd', rating: 5, text: 'Delivered exactly what I needed!' },
      description: describe(
        'Creates a review for a service request. Updates the request\\'s aggregate rating and ratingCount.',
        fmt({ reviewedRequestId: '6502abcdef1234567890abcd', rating: 5, text: 'Delivered exactly what I needed!' }),
        fmt({ review: { _id: '6506...', reviewerId: '64fd...', reviewedRequestId: '6502...', rating: 5, text: { en: 'Delivered exactly what I needed!', ar: '' } } })
      ),
"""

# Find line 841 (index 840) and insert after it
lines.insert(841, new_endpoints)

# Write back
with open('write_postman_detailed.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("✅ Reviews section patched successfully!")
