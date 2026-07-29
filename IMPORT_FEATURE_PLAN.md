# Import File Feature - Phase Implementation Plan

## Overview
Implement file import functionality for Staff role to automatically create and manage:
- Subjects (with syllabuses)
- Classes (with lecturer/student assignments)
- User accounts (Lecturer, Student)

## Feature Scope

### For Staff Role (role_id = 2)
1. **Import Subjects**: Upload CSV/Excel to create subjects with codes, names, credits, syllabuses
2. **Import Classes**: Upload CSV/Excel to link subjects to semesters and assign lecturers
3. **Import User Accounts**: Upload CSV/Excel to create lecturer and student accounts with departments

### UI Components to Create
1. **Import Modal/Tab in AdminDashboard**
   - File upload area (drag-and-drop or click)
   - Template download buttons
   - Progress indicator
   - Validation error display
   - Success/failure summary

### API Endpoints Needed
```
POST /api/v1/admin/import/subjects
POST /api/v1/admin/import/classes
POST /api/v1/admin/import/users
POST /api/v1/admin/import/validate
GET /api/v1/admin/import/templates
```

## Implementation Steps

### Step 1: Frontend - Create Import UI
- [ ] Add "Import" tab in Admin menu (Staff role only)
- [ ] Create ImportFileUI component with:
  - File upload input
  - Template download buttons
  - Import history/logs
  - Validation feedback

### Step 2: Frontend - State Management
- [ ] Handle file selection
- [ ] Validate file format (CSV/Excel)
- [ ] Show upload progress
- [ ] Display error/success messages

### Step 3: Backend - Create Import Endpoints
- [ ] CSV/Excel parsing utilities
- [ ] Validation logic (duplicates, required fields)
- [ ] Batch insert into database
- [ ] Transaction rollback on error
- [ ] Import history/audit log

### Step 4: Testing
- [ ] Create sample CSV templates
- [ ] Test with valid data
- [ ] Test error handling (duplicates, invalid data)
- [ ] Test with large files

## File Format Specifications

### Import Subjects CSV
```csv
subject_code,subject_name,credits,department_id
IT101,Lập Trình Python,4,1
IT102,Cấu Trúc Dữ Liệu,4,1
IT103,Cơ Sở Dữ Liệu,3,1
```

### Import Classes CSV
```csv
class_code,semester_id,subject_id,lecturer_id
IT101-01,1,1,uuid-lecturer-1
IT101-02,1,1,uuid-lecturer-2
IT102-01,1,2,uuid-lecturer-3
```

### Import Users CSV
```csv
email,full_name,password,role_id,department_id
student1@university.edu,Nguyễn Văn A,password123,5,1
lecturer1@university.edu,Trần Thị B,password123,4,1
staff1@university.edu,Lê Văn C,password123,2,1
```

## Functional Requirements
- **Validation**: Check duplicates, required fields, foreign key existence
- **Error Handling**: Show line numbers, exact error messages
- **Transactions**: Rollback all changes if any row fails
- **Audit**: Log who imported what and when
- **Permissions**: Only Staff (role_id=2) can access import features

## Timeline
- Phase 3.5: Frontend UI setup
- Phase 4: Backend API implementation
- Phase 4: Testing and refinement

## Next Chat Prompt
```
Bạn hãy thêm feature Import File cho Staff role bao gồm:
1. Thêm tab "Import Files" trong Admin Dashboard (chỉ Staff role thấy)
2. Giao diện upload file (CSV/Excel) với preview
3. Các template download button cho Subjects, Classes, Users
4. Hiển thị validation errors và success message
5. Optional: Một component reusable ImportFileModal
```
