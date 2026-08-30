"""
Add More Sample Resources to Database - Using psycopg2 sync
This script adds additional sample resources without deleting existing ones
"""
import psycopg2
import os
from datetime import datetime, timezone, timedelta

# Database config
DB_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres.csvlvzkucubqlfnuuizk:noud5fmSks8xf0g3@aws-1-ap-south-1.pooler.supabase.com:5432/postgres')

# Convert asyncpg to psycopg2 format
db_url = DB_URL.replace('postgresql+asyncpg://', '').split('@')
user_pass = db_url[0].split(':')
host_db = db_url[1].split('/')

DB_USER = user_pass[0]
DB_PASSWORD = user_pass[1]
DB_HOST = host_db[0].split(':')[0]
DB_PORT = int(host_db[0].split(':')[1]) if ':' in host_db[0] else 5432
DB_NAME = host_db[1] if len(host_db) > 1 else 'postgres'

def add_more_resources():
    """Add more sample resources to database"""
    
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME
    )
    cur = conn.cursor()
    
    try:
        # Get first lecturer
        cur.execute("SELECT user_id, full_name FROM users WHERE role_id = 4 LIMIT 1;")
        lecturer = cur.fetchone()
        
        if not lecturer:
            print("❌ No lecturer found. Please create a lecturer user first.")
            return
        
        lecturer_id, lecturer_name = lecturer
        print(f"📝 Using lecturer: {lecturer_name} ({lecturer_id})")
        
        # Additional sample resources with staggered dates
        additional_resources = [
            ('System Mockup.png', 'UI mockups and design wireframes', '/api/v1/resources/download/mockup.png', 'image', -10),
            ('Data Flow Diagram.png', 'Process flow and data exchange diagram', '/api/v1/resources/download/dataflow.png', 'image', -9),
            ('Database Schema.sql', 'Complete database structure and relationships', '/api/v1/resources/download/schema.sql', 'code', -8),
            ('Setup Guide.md', 'Installation and configuration instructions', '/api/v1/resources/download/setup_guide.md', 'document', -7),
            ('Meeting Minutes - Week 1.docx', 'Summary of project kickoff meeting', '/api/v1/resources/download/minutes_week1.docx', 'document', -6),
            ('Team Tracker.xlsx', 'Task allocation and progress tracking', '/api/v1/resources/download/team_tracker.xlsx', 'spreadsheet', -5),
            ('Technical Architecture Slides.pptx', 'Deep dive into technical implementation', '/api/v1/resources/download/tech_slides.pptx', 'presentation', -4),
            ('User Manual.docx', 'Complete user documentation and feature guide', '/api/v1/resources/download/user_manual.docx', 'document', -3),
            ('Github Repository', 'Complete source code and version control', 'https://github.com/example/collabsphere', 'link', -2),
            ('Project Wiki', 'Comprehensive project knowledge base', 'https://wiki.example.com/project', 'link', -1),
        ]
        
        now = datetime.now(timezone.utc)
        added_count = 0
        
        for title, description, url, file_type, days_offset in additional_resources:
            # Check if this resource already exists
            cur.execute("SELECT COUNT(*) FROM resources WHERE title = %s", (title,))
            if cur.fetchone()[0] > 0:
                print(f"⏭️  Skipped (already exists): {title}")
                continue
            
            created_at = now + timedelta(days=days_offset)
            
            cur.execute("""
                INSERT INTO resources (uploaded_by, title, description, file_url, file_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (str(lecturer_id), title, description, url, file_type, created_at))
            
            print(f"➕ Added: {title}")
            added_count += 1
        
        conn.commit()
        print(f"\n✅ Added {added_count} more sample resources!")
        
        # Show total count
        cur.execute("SELECT COUNT(*) FROM resources;")
        total = cur.fetchone()[0]
        print(f"📊 Total resources now: {total}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    add_more_resources()
