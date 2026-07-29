# ✅ Tab "Files & Documents" đã được thêm vào cả Lecturer và Student

## 📋 Những gì đã làm:

### 1. **Lecturer Dashboard** ([src/pages/LecturerDashboard.jsx](frontend/src/pages/LecturerDashboard.jsx))
✅ Thêm menu item "Files & Documents" trong section OVERVIEW
- Icon: `FolderOutlined`
- Route: `/resources`
- Vị trí: Sau "Grading & Feedback"

### 2. **Student Dashboard** ([src/components/MainLayout.jsx](frontend/src/components/MainLayout.jsx))
✅ Thêm menu item "Files & Documents" trong section OVERVIEW
- Icon: `FolderOutlined`
- Route: `/resources`
- Vị trí: Sau "Peer Review Form"
- ✅ Thêm import `FolderOutlined` vào imports

### 3. **Routing** ([src/App.jsx](frontend/src/App.jsx))
✅ Thêm import `ResourcesPage`
✅ Thêm route `/resources` (Protected route - all users)

---

## 🚀 Cách sử dụng:

### **Bước 1: Restart Frontend**
```powershell
# Di chuyển vào thư mục root
cd "D:\Python_Project\WEB TEAMWORK\web app\CollabSphere\CNPM-friday"

# Restart frontend container
docker-compose restart frontend

# Hoặc nếu đang chạy local:
cd frontend
npm start
```

### **Bước 2: Chạy Migration Database** (Nếu chưa chạy)
```powershell
cd backend
python migrate_add_resource_fields.py
cd ..
docker-compose restart backend
```

### **Bước 3: Test trên Browser**

#### **Test với Lecturer:**
1. Login: http://localhost:3000/login
   - Email: `lecturer@university.edu`
   - Password: `password123`
2. Sau khi login, trong sidebar sẽ thấy menu mới:
   ```
   OVERVIEW
   ├─ Dashboard
   ├─ Topic management
   ├─ AI Mentoring
   ├─ Grading & Feedback
   └─ Files & Documents  ← MỚI
   ```
3. Click "Files & Documents" → Redirect đến `/resources`

#### **Test với Student:**
1. Login: http://localhost:3000/login
   - Email: `student@university.edu`
   - Password: `password123`
2. Sau khi login, trong sidebar sẽ thấy menu mới:
   ```
   OVERVIEW
   ├─ Dashboard
   ├─ Team Management
   ├─ Team Chat
   ├─ Kanban Board Detail
   ├─ Video Meeting Room
   ├─ Submission Portal
   ├─ Peer Review Form
   └─ Files & Documents  ← MỚI
   ```
3. Click "Files & Documents" → Redirect đến `/resources`

---

## 🎨 UI Features trong ResourcesPage:

### **Lecturer có thể:**
- ✅ **Upload Files** - Button "Upload Files" (gradient purple)
- ✅ **View Stats** - Total Files, Storage Usage, Shared Files
- ✅ **Filter by Type** - Dropdown: All, Document, Link, Video, Image, etc.
- ✅ **View Recent Files** - Grid layout với cards
- ✅ **Delete Resources** - Click "Remove" button
- ✅ **Share with Team** - Input team_id khi upload

### **Student có thể:**
- ✅ **View Resources** - Xem resources của teams mình tham gia
- ✅ **View Class Resources** - Xem tất cả class resources
- ✅ **Open Files** - Click "View" để mở URL
- ✅ **Filter by Type** - Lọc theo document, link, video, etc.
- ❌ **Không thể Upload** - Role student không có quyền upload
- ❌ **Không thể Delete** - Không có quyền xóa

---

## 📂 Files đã chỉnh sửa:

1. ✅ [frontend/src/pages/LecturerDashboard.jsx](frontend/src/pages/LecturerDashboard.jsx)
2. ✅ [frontend/src/components/MainLayout.jsx](frontend/src/components/MainLayout.jsx)
3. ✅ [frontend/src/App.jsx](frontend/src/App.jsx)
4. ✅ [backend/app/models/all_models.py](backend/app/models/all_models.py) (đã update trước đó)
5. ✅ [backend/app/api/v1/resources.py](backend/app/api/v1/resources.py) (đã update trước đó)

---

## 🔍 Troubleshooting:

### Lỗi: Menu không hiển thị
**Nguyên nhân:** Frontend chưa restart sau khi thay đổi code

**Giải pháp:**
```powershell
docker-compose restart frontend
# Hoặc clear browser cache (Ctrl + Shift + R)
```

### Lỗi: Click vào menu bị lỗi 404
**Nguyên nhân:** Route chưa được register

**Giải pháp:**
- Kiểm tra [App.jsx](frontend/src/App.jsx) đã có route `/resources` chưa
- Restart frontend

### Lỗi: Trang Resources trống (empty)
**Nguyên nhân:** Database chưa có resources hoặc chưa migrate

**Giải pháp:**
```powershell
# 1. Chạy migration
cd backend
python migrate_add_resource_fields.py

# 2. Restart backend
cd ..
docker-compose restart backend

# 3. Upload resource đầu tiên từ UI
```

### Lỗi: "Only lecturers can upload"
**Nguyên nhân:** Đang login với account student

**Giải pháp:**
- Đúng rồi! Students chỉ có thể **View**, không thể Upload
- Login với lecturer account để test upload

---

## ✅ Checklist Testing:

### **Lecturer Dashboard:**
- [ ] Login thành công với lecturer account
- [ ] Thấy menu "Files & Documents" trong sidebar
- [ ] Click vào menu → Navigate đến `/resources`
- [ ] Thấy button "Upload Files" (màu purple gradient)
- [ ] Click Upload → Modal mở ra
- [ ] Upload resource thành công
- [ ] Resource hiển thị trong danh sách
- [ ] Click "View" → Mở URL trong tab mới
- [ ] Click "Remove" → Xóa resource thành công

### **Student Dashboard:**
- [ ] Login thành công với student account
- [ ] Thấy menu "Files & Documents" trong sidebar
- [ ] Click vào menu → Navigate đến `/resources`
- [ ] Thấy danh sách resources (của teams mình tham gia)
- [ ] Click "View" → Mở URL trong tab mới
- [ ] KHÔNG thấy button "Upload Files" (hoặc button disabled)
- [ ] KHÔNG thể delete resources

---

## 🎯 Next Features:

1. **File Upload to Storage:**
   - Upload actual files thay vì chỉ URL
   - Store trong AWS S3 / Google Cloud Storage
   - Generate signed URLs

2. **Permission Enhancements:**
   - Team leaders có thể delete resources của team
   - Lecturers chỉ xóa được resources của classes họ dạy

3. **UI Improvements:**
   - Drag & drop upload
   - File preview (PDF, images)
   - Folder organization

---

**Ready to test!** 🚀

Mở browser và test ngay:
- Lecturer: http://localhost:3000/login (lecturer@university.edu)
- Student: http://localhost:3000/login (student@university.edu)
