# File Upload API Documentation

## Two Upload Endpoints

The application provides two distinct upload endpoints for different use cases:

---

## 1. Simple File Upload (URL Only)

**Endpoint**: `POST /uploads`  
**Auth**: Required (Bearer token)  
**Purpose**: Upload files and receive only the URL(s). Ideal for chat attachments, profile pictures, and general file storage.

### Request

**Method**: `POST`  
**Headers**:
- `Authorization: Bearer {{authToken}}`

**Body**: `multipart/form-data`
- `file` (required, repeatable): File(s) to upload

### Allowed File Types
- Images: `image/png`, `image/jpeg`
- Documents: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX)

### File Size Limit
- **Max**: 10 MB per file

### Response (201 Created)

```json
{
  "files": [
    {
      "url": "https://cloudinary.com/.../image1.jpg",
      "filename": "image1.jpg",
      "size": 1024,
      "mimeType": "image/jpeg"
    },
    {
      "url": "https://cloudinary.com/.../document.pdf",
      "filename": "document.pdf",
      "size": 2048,
      "mimeType": "application/pdf"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - No files provided:
```json
{ "error": "No files provided" }
```

**400 Bad Request** - Invalid file type:
```json
{ "error": "Invalid file type. Allowed: PDF, DOCX, PNG, JPEG" }
```

**400 Bad Request** - File too large:
```json
{ "error": "File too large. Max 10MB per file" }
```

**500 Internal Server Error** - Upload failed:
```json
{ "error": "Upload failed: [reason]" }
```

### Usage Examples

#### cURL
```bash
curl -X POST http://localhost:3500/uploads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

#### JavaScript (Fetch)
```javascript
const uploadFile = async (file, authToken) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://localhost:3500/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
};

// Usage
const file = document.getElementById('fileInput').files[0];
const result = await uploadFile(file, authToken);
console.log(result.files[0].url); // Use this URL in your app
```

#### JavaScript (React)
```javascript
const uploadFiles = async (files, authToken) => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('file', file);
  });

  const response = await fetch('http://localhost:3500/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  const data = await response.json();
  return data.files;
};

// In React component
const handleUpload = async (event) => {
  const files = event.target.files;
  try {
    const uploaded = await uploadFiles(files, authToken);
    // Use uploaded[0].url for display, etc.
    setImageUrl(uploaded[0].url);
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

#### TypeScript
```typescript
interface UploadedFile {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

interface UploadResponse {
  files: UploadedFile[];
}

const uploadFiles = async (
  files: FileList,
  authToken: string
): Promise<UploadedFile[]> => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('file', file);
  });

  const response = await fetch('http://localhost:3500/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`
    },
    body: formData
  });

  const data: UploadResponse = await response.json();
  return data.files;
};
```

---

## 2. Document-Attached File Upload

**Endpoint**: `POST /uploads/attach`  
**Auth**: Required (Bearer token)  
**Purpose**: Upload files and attach them to a document (listing, request, offer, or post). Files are stored in the document's `files` array.

### Request

**Method**: `POST`  
**Headers**:
- `Authorization: Bearer {{authToken}}`

**Body**: `multipart/form-data`
- `ownerType` (required): One of `listing`, `request`, `offer`, `post`
- `ownerId` (required): MongoDB ID of the document
- `file` (required, repeatable): File(s) to upload
- `descriptions[]` (optional): Array of descriptions aligned with file order

### Response (201 Created)

```json
{
  "success": true,
  "files": [
    {
      "filename": "1701234567890-image.jpg",
      "originalname": "image.jpg",
      "mimeType": "image/jpeg",
      "size": 2048,
      "path": "/uploads/temp/1701234567890-image.jpg",
      "urlSrc": "https://cloudinary.com/.../image.jpg",
      "publicId": "listing/1701234567890-image",
      "description": "Front view"
    }
  ]
}
```

### Error Responses

**400 Bad Request** - Missing required fields:
```json
{ "error": "ownerType must be one of listing|request|offer|post" }
```

**400 Bad Request** - Invalid file:
```json
{ "error": "Invalid file type" }
```

**404 Not Found** - Document not found:
```json
{ "error": "listing not found" }
```

---

## Key Differences

| Feature | `/uploads` | `/uploads/attach` |
|---------|-----------|------------------|
| **Purpose** | Get file URLs only | Attach files to documents |
| **Response** | Just URLs | File metadata + URLs |
| **Use Case** | Chat, profiles, temporary storage | Listings, requests, posts |
| **Requires Document** | No | Yes |
| **Returns** | `files[]` with `url`, `filename`, `size`, `mimeType` | `files[]` with `description`, `publicId`, etc. |

---

## Chat Integration Example

For uploading attachments in chat, use the **simple upload** endpoint:

```javascript
// Upload file to get URL
const uploadedFiles = await uploadFile(file, authToken);
const fileUrl = uploadedFiles.files[0].url;

// Send message with attachment reference
const message = await fetch(`http://localhost:3500/chat/${conversationId}/messages`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    body: 'Here are the files',
    attachments: [
      {
        url: fileUrl,
        filename: uploadedFiles.files[0].filename
      }
    ]
  })
});
```

---

## Storage & Cleanup

- Files are uploaded to **Cloudinary** (cloud storage)
- Temporary local files in `/uploads/temp/` are automatically deleted after successful upload
- No manual cleanup needed; Cloudinary manages storage

