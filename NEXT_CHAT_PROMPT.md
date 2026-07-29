# Import File Feature - Next Chat Prompt Template

## Prompt for Next Chat Session

Bạn hãy thêm **Import File Feature** cho Staff role (role_id=2) bao gồm:

### 1. Frontend - Import File UI
- [ ] Thêm tab **"Import Files"** vào AdminDashboard (chỉ Staff role thấy)
- [ ] Giao diện upload file với:
  - Khu vực drag-and-drop hoặc click upload (CSV/Excel)
  - 3 nút download template (Subjects, Classes, Users)
  - Hiển thị danh sách import history (file name, date, status, rows affected)

### 2. Frontend - Import Modal/Components
- [ ] Tạo reusable component **ImportFileModal** hoặc **ImportTab** với:
  - File selection input
  - Progress indicator
  - Preview dữ liệu trước khi import
  - Validation error display (line numbers + field names)
  - Success message hiển thị số records đã import

### 3. Backend - Import API Endpoints (Basic structure)
```python
# Thêm vào backend/app/api/v1/endpoints/
POST /api/v1/admin/import/subjects
  - Nhận file CSV: subject_code, subject_name, credits, dept_id
  - Validate: không trùng code, dept_id tồn tại
  - Trả về: số records imported, lỗi (nếu có)

POST /api/v1/admin/import/classes
  - Nhận file CSV: class_code, semester_id, subject_id, lecturer_id
  - Validate: class_code unique, IDs tồn tại
  - Trả về: số records imported

POST /api/v1/admin/import/users
  - Nhận file CSV: email, full_name, password, role_id, dept_id
  - Validate: email unique, generate UUID, hash password
  - Trả về: số accounts created

GET /api/v1/admin/import/templates
  - Trả về links download 3 templates (CSV format)
```

### 4. File Format Specifications
**Subjects template (subjects.csv):**
```csv
subject_code,subject_name,credits,dept_id
IT101,Lập Trình Python,4,1
IT102,Cấu Trúc Dữ Liệu,4,1
IT103,Cơ Sở Dữ Liệu,3,1
```

**Classes template (classes.csv):**
```csv
class_code,semester_id,subject_id,lecturer_id
IT101-01,1,1,uuid-lecturer-1
IT101-02,1,1,uuid-lecturer-2
```

**Users template (users.csv):**
```csv
email,full_name,password,role_id,dept_id
student1@uni.edu,Nguyễn Văn A,pass123,5,1
lecturer1@uni.edu,Trần Thị B,pass123,4,1
```

### 5. Error Handling
- Validate từng row trong file
- Hiển thị: lỗi tại line X, field Y, reason Z
- Ví dụ: "Line 3: duplicate subject_code 'IT101'"
- Nếu có lỗi, rollback tất cả (không insert vào DB)

### 6. UI/UX Requirements
- Dùng Ant Design components (như AdminDashboard hiện tại)
- Consistent style với các tab khác
- Hiển thị loading spinner khi upload
- Sau import thành công, hiện summary: "X subjects imported, Y failed"

### 7. Optional (Phase 4)
- Async import (background job) cho file lớn
- Import history log (who imported, when, how many)
- Rollback tự động nếu có lỗi trong progress

## Scope
- **Estimate**: 4-6 hours (Frontend 2h, Backend 3-4h)
- **Blocking**: Không blocking, Phase 3 có thể parallel
- **Testing**: Manual test với 3 CSV templates

## Reference Files
- [IMPORT_FEATURE_PLAN.md](../IMPORT_FEATURE_PLAN.md)
- [AdminDashboard.jsx](../frontend/src/pages/AdminDashboard.jsx) (reuse styles)
- [Copilot Instructions](../.github/copilot-instructions.md)

---

**Start with:** Frontend UI mockup trước, sau đó backend endpoints
