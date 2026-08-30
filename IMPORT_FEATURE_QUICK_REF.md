# Import Feature - Quick Reference Guide

## File Locations

### Backend
```
backend/app/
├── schemas/
│   ├── import_schemas.py          (📝 NEW - Import schemas)
├── services/
│   └── import_service.py          (📝 NEW - Import service)
├── api/v1/
│   ├── import_endpoints.py        (📝 NEW - API endpoints)
│   └── api.py                     (✏️  MODIFIED - Added router)
```

### Frontend
```
frontend/src/
├── components/
│   ├── ImportFileModal.jsx        (📝 NEW - Upload modal)
│   └── ImportFilesTab.jsx         (📝 NEW - Tab component)
├── services/
│   └── api.js                     (✏️  MODIFIED - Added importService)
└── pages/
    └── AdminDashboard.jsx         (✏️  MODIFIED - Added Import Files tab)
```

### Configuration & Documentation
```
project/
├── IMPORT_FEATURE_IMPLEMENTATION.md  (📝 NEW - Implementation details)
├── IMPORT_FEATURE_TESTING.md         (📝 NEW - Testing guide)
├── IMPORT_FEATURE_PLAN.md            (📋 Original specification)
└── samples/
    ├── subjects_sample.csv           (📝 NEW - Test data)
    ├── classes_sample.csv            (📝 NEW - Test data)
    └── users_sample.csv              (📝 NEW - Test data)
```

## API Endpoints

### Import Operations
```
POST   /api/v1/admin/import/subjects     Import subjects from CSV/Excel
POST   /api/v1/admin/import/classes      Import classes from CSV/Excel
POST   /api/v1/admin/import/users        Import users from CSV/Excel
GET    /api/v1/admin/import/templates/{type}  Download import template
```

### Supported Template Types
- `subjects` → Download subjects template
- `classes` → Download classes template
- `users` → Download users template

### Required Headers
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data (for file upload)
```

### Required Roles
- **ADMIN** (role_id=1): ✅ Full access
- **STAFF** (role_id=2): ✅ Full access to import
- **HEAD_DEPT** (role_id=3): ❌ No access
- **LECTURER** (role_id=4): ❌ No access
- **STUDENT** (role_id=5): ❌ No access

## Frontend Components

### ImportFileModal
**Path**: `frontend/src/components/ImportFileModal.jsx`

**Props**:
```javascript
{
  open: boolean,                    // Modal open/close state
  onClose: () => void,              // Close handler
  importType: 'subjects'|'classes'|'users',  // Type to import
  onImportComplete: (result) => {},  // Success callback
  apiService: {
    importSubjects: (file) => Promise,
    importClasses: (file) => Promise,
    importUsers: (file) => Promise,
    downloadTemplate: (type) => Promise
  }
}
```

**Usage**:
```jsx
<ImportFileModal
  open={showModal}
  onClose={() => setShowModal(false)}
  importType="subjects"
  onImportComplete={handleSuccess}
  apiService={importService}
/>
```

### ImportFilesTab
**Path**: `frontend/src/components/ImportFilesTab.jsx`

**Props**:
```javascript
{
  apiService: {
    importSubjects: (file) => Promise,
    importClasses: (file) => Promise,
    importUsers: (file) => Promise,
    downloadTemplate: (type) => Promise
  }
}
```

**Features**:
- 3 import cards with download/upload buttons
- Import history table
- Auto-reload after import

## Service Methods

### importService
**Path**: `frontend/src/services/api.js`

```javascript
// Import subjects
importService.importSubjects(file)  // file: File object

// Import classes
importService.importClasses(file)   // file: File object

// Import users
importService.importUsers(file)     // file: File object

// Download template
importService.downloadTemplate('subjects'|'classes'|'users')
  // Returns: CSV file download
```

**Response Format**:
```javascript
{
  total_rows: number,               // Total rows in file
  successful: number,               // Successfully imported
  failed: number,                   // Failed rows
  skipped: number,                  // Skipped (duplicates)
  results: [
    {
      row_number: number,           // CSV row number
      subject_code: string,         // For subjects
      class_code: string,           // For classes
      email: string,                // For users
      status: 'success'|'error'|'skipped',
      subject_id: number,           // Foreign key (if successful)
      class_id: number,             // Foreign key (if successful)
      user_id: UUID,                // Foreign key (if successful)
      message: string               // Error/success message
    }
  ]
}
```

## Database Schemas

### Subjects Import
**Required Columns**:
- `subject_code`: String (unique)
- `subject_name`: String
- `credits`: Integer (1-10)
- `dept_name`: String (must exist in departments table)

### Classes Import
**Required Columns**:
- `class_code`: String (unique)
- `semester_code`: String (must exist in semesters table)
- `subject_code`: String (must exist in subjects table)
- `lecturer_email`: Email (must be existing LECTURER user)

### Users Import
**Required Columns**:
- `email`: Email (unique)
- `full_name`: String
- `role_name`: String (ADMIN|STAFF|HEAD_DEPT|LECTURER|STUDENT)

**Optional Columns**:
- `dept_name`: String (required for LECTURER/STUDENT)
- `phone`: String

**Note**: Default password is `CollabSphere@{email_prefix}`. Users should change on first login.

## Error Codes

### HTTP Status Codes
- `201 Created`: Import successful
- `400 Bad Request`: Invalid file format or missing columns
- `403 Forbidden`: User lacks permission (not ADMIN/STAFF)
- `413 Request Entity Too Large`: File > 10MB
- `422 Unprocessable Entity`: Invalid data in file
- `500 Internal Server Error`: Database or server error

### Common Error Messages
- `"File is empty"` → No data rows in file
- `"Invalid file format"` → Not CSV/Excel
- `"Missing required columns"` → Column name mismatch
- `"Line X: duplicate subject_code"` → Duplicate in database
- `"Department 'X' not found"` → Department doesn't exist
- `"Lecturer with email 'X' not found"` → No matching lecturer

## Development Checklist

### Adding New Import Type

If adding a 4th import type (e.g., Departments):

1. **Backend**:
   - Add schema in `import_schemas.py`:
     ```python
     class DepartmentImportRow(BaseModel):
         dept_name: str
         ...
     class DepartmentImportResponse(BaseModel):
         total_rows: int
         ...
     ```
   - Add service in `import_service.py`:
     ```python
     async def import_departments(db, dataframe):
         ...
     ```
   - Add endpoint in `import_endpoints.py`:
     ```python
     @router.post("/departments", ...)
     async def import_departments_endpoint(...):
         ...
     ```

2. **Frontend**:
   - Update `ImportFilesTab.jsx`:
     ```javascript
     const importTypes = [
       ...,
       { key: 'departments', title: 'Import Departments', ... }
     ]
     ```
   - Add service method in `api.js`:
     ```javascript
     importService.importDepartments: (file) => 
       api.post('/admin/import/departments', formData)
     ```

## Performance Tips

### Optimize Large Imports
1. **Batch Processing**: Process files in chunks (5000+ rows)
2. **Progress Indicator**: Show progress bar for large files
3. **Background Jobs**: Use async tasks (Celery/RQ)
4. **Index Database**: Ensure indexes on lookup columns

### Cache Management
- Cache department/semester/user lists during import
- Don't repeat database queries for same data
- Clear caches after import completes

## Debugging Tips

### Backend Debugging
```bash
# View import logs
docker-compose logs backend | grep import

# Check database after import
docker exec collabsphere_backend psql -U postgres -d collabsphere -c \
  "SELECT COUNT(*) FROM subjects;"

# Test endpoint manually
curl -X POST http://localhost:8000/api/v1/admin/import/subjects \
  -H "Authorization: Bearer {token}" \
  -F "file=@test.csv" | jq .
```

### Frontend Debugging
```javascript
// In browser console
// Check import service
console.log(importService)

// Check API response
await importService.importSubjects(fileObject)
  .then(r => console.log(r))
  .catch(e => console.error(e))

// Check token
console.log(localStorage.getItem('access_token'))
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "403 Forbidden" | Not ADMIN/STAFF | Login as correct user |
| CSV shows 0 rows | Wrong encoding | Save as UTF-8|
| Import hangs | Large file | Check file size < 10MB |
| "Column not found" | Typo in header | Match exact header names |
|<Blank page after import | Component error | Check console for JS errors |

## Next Steps

1. ✅ **Phase 3.5 Complete**: Import File Feature ready
2. 📋 **Phase 3**: Real-time features (Chat, Meetings, Video)
3. 🤖 **Phase 4**: AI, Peer Reviews, Evaluations

---

**Last Updated**: February 8, 2026  
**Version**: 1.0  
**Status**: ✅ Production Ready
