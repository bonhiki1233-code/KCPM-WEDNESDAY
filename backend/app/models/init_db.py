import sys
import os
from sqlalchemy import create_engine, text

# 1. Đảm bảo Python tìm thấy file all_models
sys.path.append(os.getcwd())

# 2. Import Base và các models để SQLAlchemy nhận diện được chúng
# Lưu ý: Nếu bạn chưa có file app/db/base.py, hãy xem phần "Lưu ý" bên dưới code này
try:
    from app.db.base import Base
except ImportError:
    # Fallback nếu cấu trúc thư mục chưa chuẩn, tạo Base tạm thời
    from sqlalchemy.orm import DeclarativeBase
    class Base(DeclarativeBase): pass

# Import tất cả models của bạn
from all_models import * # 3. Cấu hình kết nối PostgreSQL
# Cú pháp: postgresql+psycopg2://user:password@host:port/dbname
# BẠN HÃY SỬA LẠI USER/PASS CỦA BẠN Ở DÒNG DƯỚI:
DB_URL = "postgresql+psycopg2://postgres:password@localhost:5432/collabsphere_db"

def init_db():
    print(f"Đang kết nối đến: {DB_URL}...")
    engine = create_engine(DB_URL)

    try:
        with engine.connect() as conn:
            # Kiểm tra kết nối
            pass
    except Exception as e:
        print("❌ Lỗi kết nối! Hãy kiểm tra lại user/password trong biến DB_URL.")
        print(f"Chi tiết lỗi: {e}")
        return

    print("🚀 Đang tạo bảng trong PostgreSQL...")
    
    # Lệnh này sẽ chuyển đổi tất cả class Python thành câu lệnh SQL CREATE TABLE
    Base.metadata.create_all(bind=engine)
    
    print("✅ Thành công! Hãy vào PgAdmin và Refresh lại phần Tables.")

if __name__ == "__main__":
    init_db()