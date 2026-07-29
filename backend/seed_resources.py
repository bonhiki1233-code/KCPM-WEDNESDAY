"""
Seed Resources Data - Using psycopg2 sync
"""
import psycopg2
import os
from datetime import datetime, timezone
import uuid

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

def seed_resources():
    """Tạo sample resources"""
    
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
        
        # Check if resources already exist
        cur.execute("SELECT COUNT(*) FROM resources;")
        count = cur.fetchone()[0]
        
        if count > 0:
            print(f"⚠️  {count} resources already exist. Skipping seeding.")
            return
        
        # Sample resources
        resources = [
            # Documents & PDFs
            ('Project Requirements.pdf', 'Complete project specifications and requirements document', '/api/v1/resources/download/sample_requirements.pdf', 'pdf'),
            ('System Architecture.pdf', 'Detailed system design and architecture documentation', '/api/v1/resources/download/sample_architecture.pdf', 'pdf'),
            
            # Word Documents
            ('Development Guidelines.docx', 'Best practices, coding standards, and development workflow guidelines', '/api/v1/resources/download/sample_guidelines.docx', 'document'),
            ('Meeting Minutes - Week 1.docx', 'Summary of project kickoff meeting and action items', '/api/v1/resources/download/minutes_week1.docx', 'document'),
            ('User Manual.docx', 'Complete user documentation and feature guide', '/api/v1/resources/download/user_manual.docx', 'document'),
            
            # Spreadsheets
            ('Budget Report Q3.xlsx', 'Project budget breakdown and financial tracking', '/api/v1/resources/download/sample_budget.xlsx', 'spreadsheet'),
            ('Team Tracker.xlsx', 'Task allocation and team member progress tracking', '/api/v1/resources/download/team_tracker.xlsx', 'spreadsheet'),
            ('Timeline & Milestones.xlsx', 'Project schedule, deadlines, and milestone tracking', '/api/v1/resources/download/timeline.xlsx', 'spreadsheet'),
            
            # Presentations
            ('Project Presentation.pptx', 'Overview presentation for stakeholders and sponsors', '/api/v1/resources/download/sample_presentation.pptx', 'presentation'),
            ('Technical Architecture Slides.pptx', 'Deep dive into technical implementation and tech stack', '/api/v1/resources/download/tech_slides.pptx', 'presentation'),
            
            # Code & Technical
            ('API Documentation.json', 'REST API specifications, endpoints, and request/response format', '/api/v1/resources/download/sample_api.json', 'code'),
            ('Database Schema.sql', 'Complete database structure and relationships', '/api/v1/resources/download/schema.sql', 'code'),
            ('Setup Guide.md', 'Installation and configuration instructions for local development', '/api/v1/resources/download/setup_guide.md', 'document'),
            
            # Images
            ('System Mockup.png', 'UI mockups and design wireframes', '/api/v1/resources/download/mockup.png', 'image'),
            ('Data Flow Diagram.png', 'Process flow and data exchange diagram', '/api/v1/resources/download/dataflow.png', 'image'),
            
            # External Links
            ('Github Repository', 'Complete source code and version control access', 'https://github.com/example/collabsphere', 'link'),
            ('Project Wiki', 'Comprehensive project knowledge base and documentation site', 'https://wiki.example.com/project', 'link'),
            ('Docker Hub - Images', 'Pre-built Docker images for backend and frontend services', 'https://hub.docker.com/r/example/collabsphere', 'link'),
        ]
        
        now = datetime.now(timezone.utc)
        
        for title, description, url, file_type in resources:
            cur.execute("""
                INSERT INTO resources (uploaded_by, title, description, file_url, file_type, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (str(lecturer_id), title, description, url, file_type, now))
            print(f"➕ Added: {title}")
        
        conn.commit()
        print(f"\n✅ Seeded {len(resources)} sample resources!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    seed_resources()
