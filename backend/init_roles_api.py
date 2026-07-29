"""
Initialize roles via API endpoint.
This script calls the backend API to seed roles data.
"""
import requests
import json

API_BASE_URL = "http://localhost:8000/api"


def init_roles():
    """Create 5 default roles via API."""
    roles_data = [
        {"role_id": 1, "name": "Admin"},
        {"role_id": 2, "name": "Staff"},
        {"role_id": 3, "name": "Head_Dept"},
        {"role_id": 4, "name": "Lecturer"},
        {"role_id": 5, "name": "Student"},
    ]
    
    print("🚀 Initializing roles...")
    
    # First, create an endpoint to seed roles
    # For now, let's just verify API is accessible
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print(f"✅ API is reachable: {response.json()}")
        else:
            print(f"❌ API returned status {response.status_code}")
            return
    except requests.exceptions.RequestException as e:
        print(f"❌ Cannot connect to API: {e}")
        return
    
    print("\n📝 Expected roles:")
    for role in roles_data:
        print(f"   - {role['role_id']}: {role['name']}")
    
    print("\n⚠️  To complete setup, you need to:")
    print("   1. Access database directly (pgAdmin/psql)")
    print("   2. Run: INSERT INTO roles (role_id, name) VALUES")
    print("      (1, 'Admin'), (2, 'Staff'), (3, 'Head_Dept'),")
    print("      (4, 'Lecturer'), (5, 'Student');")


if __name__ == "__main__":
    init_roles()
