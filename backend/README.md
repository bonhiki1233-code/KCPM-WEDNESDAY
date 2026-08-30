# 📚 CollabSphere Backend - Hướng Dẫn Sử Dụng

## 🗄️ Database Setup

### PostgreSQL Connection
```
Host: localhost
Port: 5432
Database: collabsphere_db
Username: postgres
Password: 117206
```

### Connection String
```
postgresql://postgres:117206@localhost:5432/collabsphere_db
```

---

## 🚀 Cách Chạy Backend

```bash
# 1. Di chuyển vào thư mục backend
cd d:\Collab_Sphere\CNPM-friday\backend

# 2. Cài đặt dependencies (lần đầu)
pip install -r requirements.txt

# 3. Chạy migration database
alembic upgrade head

# 4. Seed dữ liệu test (lần đầu)
python scripts/seed_data.py

# 5. Khởi động server
python -m uvicorn app.main:app --reload --port 8000
```

### Swagger UI
Sau khi chạy, truy cập: **http://localhost:8000/docs**

---

## 👥 Tài Khoản Test

| Role | Email | Password |
|------|-------|----------|
| 🔴 Admin | admin@collabsphere.com | admin123 |
| 🟠 Staff | staff@collabsphere.com | staff123 |
| 🟣 Head of Dept | head_dept@collabsphere.com | head123 |
| 🔵 Lecturer | lecturer@collabsphere.com | lecturer123 |
| 🟢 Student | student1@collabsphere.com | student123 |
| 🟢 Student | student2@collabsphere.com | student123 |

---

## 🎭 Role & Permissions (RBAC)

### Role IDs
| ID | Role Name |
|----|-----------|
| 1 | Admin |
| 2 | Staff |
| 3 | Head of Dept |
| 4 | Lecturer |
| 5 | Student |

---

## 📋 API Endpoints & Permissions

### 🔐 Authentication (`/api/v1/auth/`)
| Endpoint | Method | Ai được dùng |
|----------|--------|--------------|
| `/login` | POST | Tất cả |
| `/register` | POST | Admin only |

### 📝 Topics (`/api/v1/topics/`)
| Endpoint | Method | Ai được dùng |
|----------|--------|--------------|
| `POST /` | Tạo topic | **Lecturer** only |
| `GET /` | Xem list | Tất cả (Student chỉ thấy APPROVED) |
| `GET /{id}` | Xem chi tiết | Tất cả |
| `PUT /{id}` | Cập nhật | Creator hoặc Admin |
| `DELETE /{id}` | Xóa | Creator hoặc Admin |
| `PATCH /{id}/status` | Đổi trạng thái | Xem bên dưới |

**Topic Status Flow:**
```
DRAFT → PENDING → APPROVED
  ↑        │
  └────────┘ (reject)
```
- `DRAFT → PENDING`: Lecturer (creator) submit
- `PENDING → APPROVED`: **Head of Dept** hoặc Admin duyệt
- `PENDING → DRAFT`: Reject (trả về sửa)

---

### 👥 Teams (`/api/v1/teams/`)
| Endpoint | Method | Ai được dùng |
|----------|--------|--------------|
| `POST /` | Tạo team | **Student** only |
| `GET /` | Xem list | Tất cả |
| `GET /{id}` | Xem chi tiết | Tất cả |
| `POST /join` | Join bằng code | **Student** only |
| `POST /{id}/leave` | Rời team | Member (không phải Leader) |
| `PATCH /{id}/finalize` | Lock team | **Lecturer** only |

**Lưu ý:**
- Khi tạo team, student tự động thành **Leader**
- Join code: 8 ký tự (uppercase + digits)
- Tối đa **6 thành viên** / team
- Sau khi finalize, không thể join/leave

---

### ✅ Tasks (`/api/v1/tasks/`)
| Endpoint | Method | Ai được dùng |
|----------|--------|--------------|
| `POST /` | Tạo task | Team member |
| `GET /` | Xem list | Team member (chỉ thấy task của team mình) |
| `GET /{id}` | Xem chi tiết | Team member |
| `PUT /{id}` | Cập nhật | Team member |
| `DELETE /{id}` | Xóa | **Team Leader** only |

**Task Status Flow:**
```
TODO ↔ DOING ↔ DONE
```

---

## 📂 Cấu Trúc Thư Mục

```
backend/
├── app/
│   ├── api/v1/
│   │   ├── endpoints/
│   │   │   ├── topics.py    # Topic CRUD
│   │   │   ├── teams.py     # Team formation
│   │   │   └── tasks.py     # Task board
│   │   ├── auth.py          # Login/Register
│   │   └── api.py           # Router registry
│   ├── core/
│   │   ├── config.py        # Settings (DB URL)
│   │   └── security.py      # JWT, password hash
│   ├── models/
│   │   └── all_models.py    # SQLAlchemy models
│   └── schemas/
│       ├── project.py       # Topic schemas
│       ├── team.py          # Team schemas
│       └── task.py          # Task schemas
├── scripts/
│   └── seed_data.py         # Seed test data
├── alembic/                  # Database migrations
├── alembic.ini               # Alembic config
└── requirements.txt          # Python dependencies
```

---

## ⚠️ Lưu Ý Quan Trọng

1. **Authentication**: Tất cả API (trừ login) đều cần JWT token
   - Lấy token từ `/api/v1/auth/login`
   - Thêm header: `Authorization: Bearer <token>`

2. **Status case-insensitive**: "pending" = "PENDING" = "Pending"

3. **Departments**: 
   - ID 1: Computer Science
   - ID 2: Information Technology

4. **Class IDs**: Cần có class trong database trước khi tạo team

---

## 🐛 Debug

Nếu gặp lỗi 500:
1. Kiểm tra logs của uvicorn
2. Kiểm tra database connection
3. Chạy `alembic upgrade head` nếu có model mới

Nếu gặp lỗi 401/403:
1. Token hết hạn → Login lại
2. Không đủ quyền → Dùng account phù hợp

---

## 📞 Contact

Nếu có thắc mắc, liên hệ team backend.
