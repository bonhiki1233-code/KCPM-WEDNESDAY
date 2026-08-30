# Resource Management Implementation - Complete Guide

## 📋 Tổng Quan

Đã hoàn thành **Resource Management** - hệ thống quản lý tài liệu/files cho classes, teams, milestones, checkpoints.

### ✅ Các Thay Đổi Đã Thực Hiện

#### 1. **Database Model** (backend/app/models/all_models.py)
```python
class Resource(Base):
    resource_id: int
    uploaded_by: UUID
    class_id: Optional[int]
    team_id: Optional[int]
    title: str  # ➕ MỚI
    description: Optional[str]  # ➕ MỚI
    file_url: str
    file_type: str
    created_at: datetime  # ➕ MỚI
```

**Đã thêm:**
- `title` (VARCHAR 255, NOT NULL) - Tên tài liệu
- `description` (TEXT, nullable) - Mô tả chi tiết
- `created_at` (TIMESTAMP) - Thời gian tạo

#### 2. **Migration Script** (backend/migrate_add_resource_fields.py)
Script tự động cập nhật database schema:
```bash
cd backend
python migrate_add_resource_fields.py
```

**Chức năng:**
- Thêm 3 columns mới vào bảng `resources`
- Cập nhật records cũ với default values
- Verify migration thành công

#### 3. **Backend API** (backend/app/api/v1/resources.py)
Đã cập nhật tất cả endpoints để save/return đầy đủ fields:

**POST /api/v1/resources** - Tạo resource mới
```json
{
  "title": "Project Requirements",
  "description": "Official specs",
  "url": "https://docs.google.com/...",
  "resource_type": "document",
  "team_id": 1
}
```

**GET /api/v1/resources** - Danh sách resources
- Filter by: `team_id`, `class_id`, `resource_type`
- Response bao gồm: title, description, created_at, uploader_name

**GET /api/v1/resources/{id}** - Chi tiết resource

**DELETE /api/v1/resources/{id}** - Xóa resource

#### 4. **Frontend** (frontend/src/pages/ResourcesPage.jsx)
Đã fix frontend để:
- ✅ **Bỏ MOCK_RESOURCES** - Sử dụng API thật
- ✅ Transform API response phù hợp với UI
- ✅ Handle empty state khi chưa có resources
- ✅ Upload/Delete/View resources hoạt động với backend

---

## 🚀 Hướng Dẫn Sử Dụng

### Bước 1: Chạy Migration
```powershell
# Di chuyển vào thư mục backend
cd "D:\Python_Project\WEB TEAMWORK\web app\CollabSphere\CNPM-friday\backend"

# Chạy migration script
python migrate_add_resource_fields.py
```

**Output mong đợi:**
```
🔧 Starting migration: Add Resource fields
➕ Adding 'title' column...
➕ Adding 'description' column...
➕ Adding 'created_at' column...
✅ Migration completed successfully!
```

### Bước 2: Restart Backend
```powershell
# Quay lại root folder
cd ..

# Restart backend container
docker-compose restart backend
```

### Bước 3: Test API
```powershell
# Chạy script test
.\test-resources-api.ps1
```

### Bước 4: Sử dụng Frontend
1. Mở browser: http://localhost:3000
2. Login với tài khoản lecturer hoặc student
3. Navigate đến **Files & Documents** page
4. Click **"Upload Files"** để thêm resource mới

---

## 📚 API Endpoints

### 1. Create Resource (Lecturer Only)
```bash
POST /api/v1/resources
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Project Guidelines",
  "description": "Official project setup guide",
  "url": "https://drive.google.com/...",
  "resource_type": "document",
  "team_id": 1,
  "class_id": null
}
```

**Resource Types:**
- `document` - Word, PDF, Text files
- `link` - External URLs
- `video` - YouTube, Vimeo, MP4
- `image` - PNG, JPG, SVG
- `presentation` - PowerPoint, Google Slides
- `spreadsheet` - Excel, Google Sheets
- `code` - GitHub, GitLab repos
- `other` - Archives, other files

### 2. List Resources
```bash
GET /api/v1/resources?team_id=1&resource_type=document
Authorization: Bearer <token>
```

**Query Parameters:**
- `team_id` - Filter by team
- `class_id` - Filter by class
- `resource_type` - Filter by type
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 20)

### 3. Get Resource Details
```bash
GET /api/v1/resources/123
Authorization: Bearer <token>
```

### 4. Delete Resource
```bash
DELETE /api/v1/resources/123
Authorization: Bearer <token>
```

**Permissions:**
- Uploader có thể xóa resource của mình
- Admin/Staff có thể xóa bất kỳ resource nào

---

## 🎨 Frontend Features

### Resources Page UI
- **Header**: Upload button, View All Files link
- **Stats**: Total files, Storage usage, Shared files
- **Search/Filter**: Filter by resource type (All, Document, Link, Video, etc.)
- **Uploaded Files List**: Recent uploads with actions
- **Recent Files Grid**: Card view của files gần đây
- **Quick Actions**: Export PDF, Create Folder, New Document

### Upload Modal
- Title input (required)
- URL input (required, validation)
- Auto-detect resource type từ URL
- Description textarea (optional)
- Team ID input (optional, để share với team)

### File Actions
- **View** (👁️): Mở URL trong tab mới
- **Delete** (🗑️): Xóa resource (với confirmation)

---

## 🔒 Permissions

### Lecturer
- ✅ Upload resources
- ✅ Delete own resources
- ✅ View all team/class resources

### Student
- ❌ Cannot upload (role_id = 5)
- ✅ View resources của teams mình tham gia
- ✅ View all class resources
- ✅ Cannot delete any resources

### Admin/Staff
- ✅ Upload resources
- ✅ Delete any resource
- ✅ View all resources

---

## 🧪 Testing

### Manual Testing Flow
1. **Login as Lecturer**
2. **Create Resource:**
   - Click "Upload Files" button
   - Fill form: Title, URL, Type, Description
   - Click "Upload"
3. **View Resources:**
   - See resource in "Uploaded Files" list
   - Check stats updated (Total Files)
4. **Filter:**
   - Select resource type from dropdown
   - Click "Refresh"
5. **Delete:**
   - Click "Remove" button
   - Confirm deletion

### Automated Testing
```powershell
# Run test script
.\test-resources-api.ps1

# Expected results:
# ✅ Login successful
# ✅ Create resource
# ✅ List resources
# ✅ Get resource details
# ✅ Filter by type
# ✅ Delete resource
```

---

## 📊 Database Schema

```sql
CREATE TABLE resources (
    resource_id SERIAL PRIMARY KEY,
    uploaded_by UUID REFERENCES users(user_id),
    class_id INT REFERENCES academic_classes(class_id),
    team_id INT REFERENCES teams(team_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_url VARCHAR NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 🐛 Troubleshooting

### Lỗi: "Failed to load resources"
**Nguyên nhân:** Backend chưa khởi động hoặc database chưa migrate

**Giải pháp:**
```powershell
# 1. Check backend logs
docker-compose logs backend

# 2. Run migration
cd backend
python migrate_add_resource_fields.py

# 3. Restart backend
docker-compose restart backend
```

### Lỗi: "Only lecturers can upload"
**Nguyên nhân:** Đang login với tài khoản student

**Giải pháp:**
- Login với lecturer@university.edu
- Hoặc admin@university.edu

### Resources hiển thị empty
**Nguyên nhân:** Database chưa có resources

**Giải pháp:**
- Upload resource mới từ UI
- Hoặc chạy test script để tạo sample data

---

## ✅ Checklist Hoàn Thành

- [x] Update Resource model (title, description, created_at)
- [x] Create migration script
- [x] Update backend API endpoints
- [x] Fix frontend ResourcesPage
- [x] Test CRUD operations
- [x] Create test script
- [x] Write documentation

---

## 🎯 Next Steps

1. **File Upload to Storage:**
   - Implement file upload API (multipart/form-data)
   - Store files in cloud storage (AWS S3, Google Cloud Storage)
   - Generate signed URLs

2. **Advanced Features:**
   - Search resources by title/description
   - Bulk upload multiple files
   - Resource tags and categories
   - Download statistics
   - Version control (track file updates)

3. **UI Improvements:**
   - Drag & drop upload
   - Preview thumbnails for images/PDFs
   - In-app file viewer (PDF, images)
   - Folder organization

---

## 📞 Support

Nếu gặp vấn đề:
1. Check backend logs: `docker-compose logs backend`
2. Check frontend console: F12 → Console
3. Verify database migration: Check resources table structure
4. Test API directly: http://localhost:8000/docs#/resources

---

**Ngày cập nhật:** February 8, 2026  
**Phiên bản:** 1.0 - Production Ready ✅
