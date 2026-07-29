Nguồn: Phạm Nguyễn Minh Nghi - môn Công Nghệ Phần Mềm - Giảng viên hướng dẫn thầy Chiến

🌐 CollabSphere - Project-Based Learning Management System
Chào mừng đến với CollabSphere! Đây là đồ án Capstone (Đồ án tốt nghiệp) xây dựng hệ thống quản lý học tập theo dự án, tích hợp AI và Real-time collaboration.

🛠️ Tech Stack (Công nghệ sử dụng)
Backend: Python 3.10, FastAPI, SQLAlchemy 2.0 (Async), Pydantic.

Database: PostgreSQL (Lưu trữ chính), Redis (Caching & Pub/Sub).

Frontend: React 18 (Vite), Ant Design, Axios.

Infrastructure: Docker, Docker Compose.

AI & Real-time: Google Gemini API, Socket.IO.

📂 Cấu trúc dự án (Project Structure)
Chúng ta sử dụng kiến trúc Service-Layered đơn giản hóa (Pragmatic Architecture).

    plaint text 
    CNPM-FRIDAY/
    ├── docker-compose.yml       # File chạy toàn bộ hệ thống (DB, Backend, Frontend)
    ├── .github/                 # Chứa tài liệu hướng dẫn cho AI (Copilot)
    ├── backend/                 # Source code Backend (FastAPI)
    │   ├── requirements.txt     # Các thư viện Python cần thiết
    │   └── app/
    │       ├── main.py          # Điểm khởi chạy App & cấu hình CORS
    │       ├── api/
    │       │   ├── deps.py      # Dependency Injection (Lấy User hiện tại, DB Session)
    │       │   └── v1/          # Các API Endpoints
    │       │       ├── auth.py      # Login/Register
    │       │       ├── users.py     # Quản lý Profile
    │       │       └── projects.py  # Quản lý Đề tài
    │       ├── core/            # Cấu hình hệ thống (Config, Security, JWT)
    │       ├── db/              # Kết nối Database (Session, Async Engine)
    │       ├── models/          # SQLAlchemy Models (Định nghĩa bảng DB) -> Code vào đây
    │       ├── schemas/         # Pydantic Models (Validate dữ liệu đầu vào/ra) -> Code vào đây
    │       └── services/        # Logic nghiệp vụ phức tạp (AI, Chat...)
    └── frontend/                # Source code Frontend (React)
        ├── src/
        │   ├── services/        # Gọi API Backend (Axios)
        │   ├── pages/           # Giao diện các trang
        │   └── components/      # Các thành phần UI tái sử dụng






    Plaint text
    CLUSTER 1: System Identity & Access
    ├── Role (ADMIN, LECTURER, STUDENT)
    ├── User
    ├── Department
    └── AuditLog
    CLUSTER 2: Academic Management
    ├── Semester
    ├── Subject
    ├── Syllabus
    ├── AcademicClass
    └── ClassEnrollment
    CLUSTER 3: Project & Team
    ├── Topic (Đề tài)
    ├── Project
    ├── Team
    └── TeamMember
    CLUSTER 4: Agile & Collaboration
    ├── Sprint
    ├── Task
    ├── Meeting
    ├── Channel
    └── Message
    CLUSTER 5: Milestones & Submissions
    ├── Milestone
    ├── Checkpoint
    └── Submission
    CLUSTER 6: Evaluation & Resources
    ├── EvaluationCriterion
    ├── Evaluation
    ├── PeerReview
    └── Resource

🚀 Hướng dẫn Cài đặt & Chạy (Quick Start)
Yêu cầu: Máy tính đã cài đặt Docker Desktop.

1. Clone dự án
Bash

git clone <https://github.com/Phiadz/CNPM-friday.git>
cd CNPM-friday
2. Khởi động hệ thống (Chạy bằng Docker)
Mở Terminal tại thư mục gốc CNPM-FRIDAY và chạy lệnh:

Bash

# Lần đầu chạy hoặc khi có thư viện mới cần cài đặt:
docker-compose up --build

# Các lần sau chỉ cần chạy:
docker-compose up
3. Truy cập
Sau khi Terminal hiện log xanh và không báo lỗi, truy cập:

Backend Swagger UI (API Docs): http://localhost:8000/docs

Frontend Web App: http://localhost:3000

Database: Port 5432 (User: collabsphere, Pass: collabsphere_password, DB: collabsphere_db).

👨‍💻 Quy trình làm việc (Development Workflow)
Để tránh xung đột code (Conflict), mọi người tuân thủ quy tắc sau:

1. Nguyên tắc Git
Không bao giờ push code trực tiếp lên nhánh main.

Mỗi chức năng tạo một nhánh riêng từ main:

Cú pháp: feature/[tên-chức-năng] (Ví dụ: feature/login-page, feature/create-project).

Khi code xong -> Tạo Pull Request (PR) -> Báo Leader review -> Merge.

2. Nguyên tắc Backend Dev
Chúng ta KHÔNG dùng Repository Pattern phức tạp. Hãy code theo luồng đơn giản:

Models: Kiểm tra models/all_models.py, nếu thiếu bảng thì thêm vào.

Schemas: Tạo Pydantic model trong schemas/ để kiểm tra dữ liệu gửi lên/trả về.

Endpoints: Viết API trong api/v1/.

Gọi trực tiếp db.execute(select(...)) trong endpoint.

Dùng await cho mọi thao tác Database.

3. Nguyên tắc Frontend Dev
API Service: Mọi lệnh gọi API phải viết trong src/services/api.js hoặc file service tương ứng (không viết hard-code trong Component).

UI: Sử dụng Ant Design components.

🤖 Hỗ trợ từ AI (Dành cho Member)
Dự án có sẵn file hướng dẫn cho AI. Khi các bạn dùng ChatGPT/Copilot để code, hãy copy nội dung file .github/copilot-instructions.md đưa cho nó đọc trước.

Prompt mẫu để nhờ AI viết API:

"Tôi đang làm module [Tên Module]. Dựa vào file models/all_models.py, hãy viết giúp tôi file schemas/[tên].py và api/v1/[tên].py. Sử dụng FastAPI, SQLAlchemy AsyncSession và Pydantic."

❓ Troubleshooting (Sửa lỗi thường gặp)
1. Lỗi ModuleNotFoundError (Ví dụ: thiếu asyncpg, email-validator) Lỗi này do Docker đang nhớ cache cũ chưa cài thư viện mới.

Cách sửa:

Bash

docker-compose down
docker-compose build --no-cache backend
docker-compose up
2. Lỗi Database FATAL: database "collabsphere" does not exist Lỗi này do config DB cũ còn lưu.

Cách sửa (Cẩn thận: Xóa sạch dữ liệu):

Bash

docker-compose down
docker volume prune -f
docker-compose up --build
3. Frontend báo lỗi kết nối / CORS

Kiểm tra xem Backend đã chạy chưa (vào link Swagger xem được không).

Kiểm tra file backend/app/core/config.py xem đã thêm http://localhost:3000 vào BACKEND_CORS_ORIGINS chưa.


# các bugs
nhiều project bị lặp lại là do dùng để test chức năng cuộn của bảng project, chưa có dữ liệu thực tế.
