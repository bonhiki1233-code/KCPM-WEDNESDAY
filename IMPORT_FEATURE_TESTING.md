# Import Feature Testing Guide

## Quick Start Testing

### Prerequisites
1. Docker Desktop running
2. Backend and frontend containers up: `docker-compose up`
3. All services accessible:
   - Backend: http://localhost:8000
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs

### 1. Create Test User (Staff Role)

First, register a Staff user to access Import Files tab:

**POST** `http://localhost:8000/api/v1/auth/register`

```json
{
  "email": "staff-test@university.edu",
  "password": "TestPassword123!",
  "role_id": 2,
  "full_name": "Test Staff User"
}
```

Then login with this user to access the Admin Dashboard.

### 2. Create Required Dependencies

Before importing, ensure you have:
- At least 1 Department in database
- At least 1 Semester in database
- For Lecturer imports: At least 1 Department

**Quick Option**: Use Admin Dashboard to create:
- Department: "Software Engineering" (role_id=1 can create)
- Semester: "2026-SPRING" (role_id=1 can create)

### 3. Test Subject Import

1. Go to Admin Dashboard → Import Files tab
2. Click "Import Subjects" card → "Download Template"
3. Open `samples/subjects_sample.csv` in Excel/Text editor
4. Review the format (10 sample subjects included)
5. Click "Import Subjects" → "Upload File"
6. Select the CSV file → Click "Import"
7. Verify Results:
   - "Total Rows": 10
   - "Successful": Should match number of unique subject codes
   - "Skipped": 0 (unless duplicates exist)
   - "Failed": 0 (if all data is valid)

### 4. Test Class Import

**Prerequisites**: Must have:
- Existing subjects (from Step 3)
- Existing semester with code "2026-SPRING"
- Existing lecturers with emails matching the CSV

1. Create Test Lecturers (if needed):
   - Use User Management tab to create users with role "Lecturer"
   - Use emails: lecturer1@university.edu, lecturer2@university.edu, etc.

2. Download class template → Download `samples/classes_sample.csv`
3. Update lecturer emails if needed to match test users
4. Import file → Verify success

### 5. Test User Import

1. Download template → Download `samples/users_sample.csv`
2. Review the CSV format
3. Upload file → Click Import
4. Verify Results:
   - All 12 users should import successfully
   - Check User Management tab → See new users listed
   - Default password format: `CollabSphere@{email_prefix}`

### 6. Test Error Handling

#### Test Duplicate Subject Code:
1. Modify subjects_sample.csv
2. Add duplicate row: `IT101,Duplicate Item,4,Software Engineering`
3. Import → Should skip with message "Subject code 'IT101' already exists"

#### Test Invalid Credits:
1. Modify subjects_sample.csv
2. Change credits to: `IT999,Invalid Subject,15,Software Engineering`
3. Import → Should fail with message "credits must be between 1 and 10"

#### Test Non-existent Department:
1. Modify subjects_sample.csv
2. Change dept_name to: `IT888,Invalid Dept,4,Unknown Department`
3. Import → Should fail with message "Department 'Unknown Department' not found"

#### Test Invalid Email:
1. Modify users_sample.csv
2. Change email to: `invalid-email,Test User,STUDENT,Software Engineering,`
3. Import → Should fail with message "Invalid email format"

### 7. Test Template Download

Each import type should provide download templates in correct format:

**Subjects Template**:
```csv
subject_code,subject_name,credits,dept_name
IT101,Sample Subject,4,Software Engineering
```

**Classes Template**:
```csv
class_code,semester_code,subject_code,lecturer_email
IT101-01,2026-SPRING,IT101,lecturer@university.edu
```

**Users Template**:
```csv
email,full_name,role_name,dept_name,phone
student@university.edu,Sample Student,STUDENT,Software Engineering,0912345678
```

### 8. Test Role-Based Access

#### Admin User (role_id=1):
- ✅ Can access "Import Files" tab
- ✅ Can import subjects, classes, users

#### Staff User (role_id=2):
- ✅ Can access "Import Files" tab
- ✅ Can import subjects, classes, users

#### Lecturer User (role_id=4):
- ❌ Cannot see "Import Files" tab

#### Head of Department (role_id=3):
- ❌ Cannot see "Import Files" tab

#### Student User (role_id=5):
- ❌ Cannot see "Import Files" menu

### 9. Test Import History

1. After each successful import, check "Import History" table
2. Verify it shows:
   - Type icon and name (Subjects, Classes, Users)
   - Date and time of import
   - Total, Successful, Failed, Skipped counts
   - Status badge (Success/Warnings)

### 10. Test Large File Handling

**Performance Test**:
1. Create a subjects file with 100 rows
2. Import → Should complete in < 5 seconds
3. Verify all successfully imported (assuming no errors)

**Maximum File Size**:
- Limit: 10MB per file
- Test: Try uploading file > 10MB → Should get error

## API Testing (Using Postman/cURL)

### Get Admin Token
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=staff-test@university.edu&password=TestPassword123!&grant_type=password"

# Response:
# {"access_token": "eyJ0eXAi...", "token_type": "bearer"}
```

### Download Template
```bash
curl -X GET http://localhost:8000/api/v1/admin/import/templates/subjects \
  -H "Authorization: Bearer {access_token}" \
  -o subjects_template.csv
```

### Import Subjects
```bash
curl -X POST http://localhost:8000/api/v1/admin/import/subjects \
  -H "Authorization: Bearer {access_token}" \
  -F "file=@subjects_sample.csv"

# Response:
# {
#   "total_rows": 10,
#   "successful": 10,
#   "failed": 0,
#   "skipped": 0,
#   "results": [...]
# }
```

### Check API Documentation
Navigate to http://localhost:8000/docs to see:
- All endpoint specifications
- Request/response schemas
- Try-it-out interface

## Browser Testing

### Test in Different Browsers:
1. **Chrome**: UI rendering, file upload
2. **Firefox**: Drag-and-drop functionality
3. **Safari**: CSS compatibility
4. **Edge**: Cross-browser compatibility

### Test Edge Cases:
1. Upload file while loading
2. Close modal during import
3. Rapid successive imports
4. Network latency (DevTools throttling)

## Data Verification

After imports, verify data in database:

```sql
-- Check imported subjects
SELECT * FROM subjects ORDER BY created_at DESC LIMIT 10;

-- Check imported classes
SELECT ac.*, s.subject_code, u.full_name as lecturer_name
FROM academic_classes ac
JOIN subjects s ON ac.subject_id = s.subject_id
JOIN users u ON ac.lecturer_id = u.user_id
ORDER BY ac.created_at DESC LIMIT 10;

-- Check imported users
SELECT * FROM users WHERE created_at > NOW() - INTERVAL 1 HOUR;

-- Check import stats by type
SELECT role_name, COUNT(*) FROM users GROUP BY role_name;
```

## Troubleshooting

### Issue: "File is empty"
- **Cause**: CSV file has no data rows after header
- **Fix**: Ensure CSV has at least 1 data row

### Issue: "Missing required columns"
- **Cause**: CSV headers don't match expected format
- **Fix**: Download template and match exact column names

### Issue: "Department not found"
- **Cause**: Department name doesn't exist in database
- **Fix**: Create Department first in System Settings

### Issue: "Import failed" (no details)
- **Cause**: Backend error not properly reported
- **Fix**: Check browser console for actual error message

### Issue: Modal closes without saving
- **Cause**: Network timeout or session expired
- **Fix**: Refresh page, re-login, try again

### Issue: File upload doesn't work
- **Cause**: Browser cache or file format issue
- **Fix**: Clear cache, use recommended CSV format

## Performance Benchmarks

**Expected Performance** (on local machine):
- 10 subjects: < 1 second
- 50 classes: < 2 seconds
- 100 users: < 3 seconds
- 1000 records: < 10 seconds

**If slower**:
- Check backend logs for errors
- Verify database connection
- Monitor CPU/Memory usage

## Cleanup After Testing

```bash
# Remove test data (optional)
# Via UI: Delete from respective management tabs

# Reset to clean state:
docker-compose down -v  # Remove volumes
docker-compose up       # Fresh start
```

---

**Test Duration**: ~30-45 minutes for full coverage  
**Pass Criteria**: All tests pass without errors  
**Sign-off**: When all scenarios complete successfully
