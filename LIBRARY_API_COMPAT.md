# Library API Compatibility (Desktop + Web)

This project expects Site Library endpoints to stay response-compatible across all aliases.

## Canonical Record Shape

```json
{
  "id": "file_abc123",
  "name": "mix-v4.wav",
  "size": 2419999,
  "mimeType": "audio/wav",
  "storagePath": "libraries/user123/site/file_abc123_mix-v4.wav",
  "downloadURL": "https://...",
  "uploadedAt": "2026-02-13T18:40:00.000Z",
  "source": "site"
}
```

Accepted legacy aliases are still mapped by the desktop client:
- `fileId`/`_id` for `id`
- `fileName`/`title` for `name`
- `fileSize` for `size`
- `contentType` for `mimeType`
- `url`/`fileUrl` for `downloadURL`
- `path` for `storagePath`
- `createdAt`/`timestamp` for `uploadedAt`

## GET aliases (list)

Supported aliases:
- `GET /api/library`
- `GET /api/library/list`
- `GET /api/files/library`
- `GET /api/user/library`

### Request

Headers:
- `Authorization: Bearer <firebase-id-token>`
- `Accept: application/json`

### Response (stable)

Any of these response envelopes are accepted:

```json
[{ "id": "file_1", "name": "song.wav" }]
```

```json
{ "items": [{ "id": "file_1", "name": "song.wav" }] }
```

```json
{ "files": [{ "id": "file_1", "name": "song.wav" }] }
```

```json
{ "data": [{ "id": "file_1", "name": "song.wav" }] }
```

```json
{ "data": { "items": [{ "id": "file_1", "name": "song.wav" }] } }
```

```json
{ "result": { "items": [{ "id": "file_1", "name": "song.wav" }] } }
```

## POST aliases (upload)

Supported aliases:
- `POST /api/library`
- `POST /api/library/upload`
- `POST /api/files/library/upload`

### Request (multipart/form-data)

Fields:
- `file` (binary, required)
- `name` (required)
- `size` (required)
- `mimeType` (required)
- `type` (optional)
- `source=site` (required)

Validation target:
- Reject missing file/name/mime/size
- Reject files larger than 250MB

### Response (stable)

Any of these response forms are accepted:

```json
{ "id": "file_1", "name": "song.wav", "downloadURL": "https://..." }
```

```json
{ "item": { "id": "file_1", "name": "song.wav", "downloadURL": "https://..." } }
```

```json
{ "data": { "id": "file_1", "name": "song.wav", "downloadURL": "https://..." } }
```

## DELETE aliases

Supported aliases:
- `DELETE /api/library/:fileId`
- `DELETE /api/library/delete/:fileId`
- `DELETE /api/files/library/:fileId`

### Request

Headers:
- `Authorization: Bearer <firebase-id-token>`

### Response

Client treats any `2xx` as success.

## Audit summary (current desktop workspace)

- Site Library writes use API aliases above.
- Site Library reads use API aliases with fallback to `users/{uid}/library` Firestore for compatibility.
- App Cloud/Cache metadata still uses `userLibraries/{uid}` and is intentionally separate from Site Library canonical path.