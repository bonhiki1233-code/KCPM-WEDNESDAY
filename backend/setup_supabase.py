#!/usr/bin/env python3
"""
Quick Supabase Setup Wizard for CollabSphere

This script helps you:
1. Configure Supabase connection
2. Migrate your database schema
3. Verify the connection
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
import asyncio


def print_header(text):
    """Print a formatted header."""
    print("\n" + "="*60)
    print(f"  {text}")
    print("="*60)


def print_step(step, text):
    """Print a numbered step."""
    print(f"\n📌 Step {step}: {text}")


def get_supabase_url():
    """Get Supabase project URL from user."""
    print_step(1, "Enter your Supabase Project URL")
    print("  Find it at: Supabase Dashboard (top left corner)")
    print("  Format: https://[PROJECT-ID].supabase.co")
    url = input("\n  Supabase URL: ").strip()
    
    if not url.startswith("https://"):
        print("  ❌ URL must start with https://")
        return get_supabase_url()
    return url


def get_database_password():
    """Get Supabase database password from user."""
    print_step(2, "Enter your Supabase Database Password")
    print("  Find it at: Settings > Database > Reset Database Password")
    from getpass import getpass
    password = getpass("  Password (hidden): ").strip()
    
    if not password:
        print("  ❌ Password cannot be empty")
        return get_database_password()
    return password


def construct_connection_string(url, password):
    """Construct PostgreSQL connection string from Supabase URL and password."""
    # Extract project ID from URL: https://csvlvzkucubqlfnuuizk.supabase.co
    project_id = url.split("//")[1].split(".supabase.co")[0]
    
    connection_string = f"postgresql://postgres.{project_id}:{password}@db.{project_id}.supabase.co:5432/postgres"
    return connection_string


def save_env_file(env_path, connection_string):
    """Save connection string to .env file."""
    print_step(3, "Saving Configuration")
    
    # Load existing .env if it exists
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key] = value
    
    # Update DATABASE_URL
    env_vars["DATABASE_URL"] = connection_string
    
    # Write back to .env
    with open(env_path, "w") as f:
        # Write header
        f.write("# CollabSphere Configuration\n")
        f.write("# Updated by Supabase setup wizard\n\n")
        
        # Write DATABASE_URL first
        f.write(f"DATABASE_URL={env_vars['DATABASE_URL']}\n\n")
        
        # Write other variables
        for key, value in env_vars.items():
            if key != "DATABASE_URL":
                f.write(f"{key}={value}\n")
        
        # Add defaults if missing
        if "SECRET_KEY" not in env_vars:
            f.write("\n# Security\n")
            f.write("SECRET_KEY=your-secret-key-change-in-production\n")
            f.write("ALGORITHM=HS256\n")
            f.write("ACCESS_TOKEN_EXPIRE_MINUTES=30\n")
        
        if "CORS_ORIGINS" not in env_vars:
            f.write("\n# CORS\n")
            f.write("CORS_ORIGINS=http://localhost:3000,http://localhost:5173\n")
    
    print(f"  ✅ Configuration saved to {env_path}")


async def test_connection(connection_string):
    """Test the database connection."""
    print_step(4, "Testing Connection")
    
    try:
        from sqlalchemy.ext.asyncio import create_async_engine
        
        # Convert to asyncpg URL
        asyncpg_url = connection_string.replace(
            "postgresql://", 
            "postgresql+asyncpg://"
        )
        
        print(f"  Connecting to Supabase...")
        engine = create_async_engine(asyncpg_url, pool_pre_ping=True)
        
        async with engine.begin() as conn:
            result = await conn.exec_driver_sql("SELECT version();")
            version = result.fetchone()
            print(f"  ✅ Connected successfully!")
            print(f"  Database: {version[0].split(',')[0]}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"  ❌ Connection failed: {e}")
        return False


async def run_migration(connection_string):
    """Run database migration."""
    print_step(5, "Running Database Migration")
    
    try:
        # Import migration function
        from supabase_migration import migrate_to_supabase
        
        # Convert to asyncpg URL
        asyncpg_url = connection_string.replace(
            "postgresql://", 
            "postgresql+asyncpg://"
        )
        
        await migrate_to_supabase(asyncpg_url)
        return True
        
    except Exception as e:
        print(f"  ❌ Migration failed: {e}")
        return False


async def main():
    """Main setup wizard."""
    os.chdir(Path(__file__).parent)
    
    print_header("🚀 CollabSphere Supabase Setup Wizard")
    
    print("\nThis wizard will help you:")
    print("  ✓ Configure Supabase connection")
    print("  ✓ Test the connection")
    print("  ✓ Migrate your database schema")
    print("  ✓ Create all tables")
    
    # Step 1: Get Supabase URL
    supabase_url = get_supabase_url()
    
    # Step 2: Get password
    password = get_database_password()
    
    # Step 3: Construct connection string
    connection_string = construct_connection_string(supabase_url, password)
    
    # Step 4: Save to .env
    env_path = Path(".env")
    save_env_file(str(env_path), connection_string)
    
    # Step 5: Test connection
    print("\n⏳ This may take a moment...")
    if not await test_connection(connection_string):
        print("\n⚠️  Connection test failed. Please verify your credentials.")
        return
    
    # Step 6: Run migration
    print("\n⏳ Creating database tables...")
    if not await run_migration(connection_string):
        print("\n⚠️  Migration failed. See errors above.")
        return
    
    # Success!
    print_header("✨ Setup Complete!")
    print("\n✅ Your Supabase database is ready to use!")
    print("\nNext steps:")
    print("  1. Start the backend: docker-compose up backend")
    print("  2. Test API: curl http://localhost:8000/health")
    print("  3. Visit API docs: http://localhost:8000/docs")
    print("\nFor more help, see SUPABASE_MIGRATION.md")


if __name__ == "__main__":
    try:
        # Load .env to check existing config
        load_dotenv(find_dotenv())
        
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⛔ Setup cancelled by user.")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
