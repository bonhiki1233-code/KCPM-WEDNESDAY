import requests
import sys
import time
import json

BASE_URL = "http://localhost:8000/api/v1"
users = {
    "lecturer": {"email": f"lecturer_{int(time.time())}@example.com", "password": "password123", "role_id": 4, "full_name": "Dr. Lecturer"},
    "admin": {"email": f"admin_{int(time.time())}@example.com", "password": "password123", "role_id": 1, "full_name": "Admin User"},
    "student1": {"email": f"student1_{int(time.time())}@example.com", "password": "password123", "role_id": 5, "full_name": "Student One"},
    "student2": {"email": f"student2_{int(time.time())}@example.com", "password": "password123", "role_id": 5, "full_name": "Student Two"},
}
tokens = {}
ids = {}

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def fail(msg):
    log(msg, "FAIL")
    # Don't exit immediately, try to continue or return False
    return False

def success(msg):
    log(msg, "PASS")
    return True

def init_db():
    try:
        r = requests.post(f"{BASE_URL}/admin/init-db")
        if r.status_code in [200, 201]:
            success("Database initialized")
        else:
            fail(f"Init DB failed: {r.text}")
    except Exception as e:
        fail(f"Init DB exception: {e}")

def register_user(user_key):
    user = users[user_key]
    try:
        # Try login first to see if exists
        login_data = {
            "username": user["email"],
            "password": user["password"],
            "grant_type": "password"
        }
        r = requests.post(f"{BASE_URL}/auth/login", data=login_data)
        if r.status_code == 200:
            log(f"User {user_key} already exists")
            return

        # Register
        r = requests.post(f"{BASE_URL}/auth/register", json=user)
        if r.status_code in [200, 201]:
            success(f"Registered {user_key}")
        else:
            # It might be 400 if already exists but login failed for some reason?
            log(f"Register {user_key}: {r.status_code} - {r.text}", "WARN")
    except Exception as e:
        fail(f"Register {user_key} exception: {e}")

def login_user(user_key):
    user = users[user_key]
    try:
        data = {
            "username": user["email"],
            "password": user["password"],
            "grant_type": "password"
        }
        r = requests.post(f"{BASE_URL}/auth/login", data=data)
        if r.status_code == 200:
            tokens[user_key] = r.json()["access_token"]
            success(f"Logged in {user_key}")
        else:
            fail(f"Login {user_key} failed: {r.text}")
    except Exception as e:
        fail(f"Login {user_key} exception: {e}")

def flow_topics():
    log("--- Flow 1: Topic Lifecycle ---")
    headers_lecturer = {"Authorization": f"Bearer {tokens['lecturer']}"}
    headers_student1 = {"Authorization": f"Bearer {tokens['student1']}"}
    headers_admin = {"Authorization": f"Bearer {tokens['admin']}"}

    # Step 1: Lecturer creates topic
    topic_data = {
        "title": "AI Chatbot Project Run " + str(int(time.time())),
        "description": "Build an AI-powered chatbot using NLP",
        "requirements": "Python 3.9+, Basic ML knowledge",
        "dept_id": 1  # Added dept_id
    }
    r = requests.post(f"{BASE_URL}/topics", headers=headers_lecturer, json=topic_data)
    if r.status_code == 201:
        topic_id = r.json()["topic_id"] # Fixed key
        ids["topic_id"] = topic_id
        success(f"Topic created: {topic_id}")
    else:
        fail(f"Create topic failed: {r.text}")
        return

    # Step 2: Student view (should be hidden/empty or not contain this topic)
    r = requests.get(f"{BASE_URL}/topics", headers=headers_student1)
    if r.status_code == 200:
        data = r.json().get("topics", [])
        found = any(t["topic_id"] == ids["topic_id"] for t in data)
        if not found:
            success("Topic hidden from student (correct)")
        else:
            fail("Topic visible to student before approval (incorrect)")
    else:
        fail(f"Student list topics failed: {r.text}")

    # Step 3: Admin approve
    r = requests.patch(f"{BASE_URL}/topics/{ids['topic_id']}/approve", headers=headers_admin)
    if r.status_code == 200:
        success("Topic approved by admin")
    else:
        fail(f"Approve topic failed: {r.text}")

    # Step 4: Student see
    r = requests.get(f"{BASE_URL}/topics", headers=headers_student1)
    if r.status_code == 200:
        data = r.json().get("topics", [])
        found = any(t["topic_id"] == ids["topic_id"] for t in data)
        if found:
            success("Topic visible to student after approval")
        else:
            fail("Topic still hidden from student after approval")
    else:
        fail(f"Student list topics failed: {r.text}")

def flow_teams():
    log("--- Flow 2: Team Formation ---")
    headers_student1 = {"Authorization": f"Bearer {tokens['student1']}"}
    headers_student2 = {"Authorization": f"Bearer {tokens['student2']}"}
    headers_lecturer = {"Authorization": f"Bearer {tokens['lecturer']}"}
    
    if "topic_id" not in ids:
        fail("Skipping Flow 2 caused by Flow 1 failure")
        return

    # Step 1: Create Team
    team_data = {
        "name": "Team Alpha " + str(int(time.time())),
        # "project_id": ids["topic_id"],  # Removed to avoid FK error as Project doesn't exist
        "description": "A team to build the AI chatbot"
    }
    r = requests.post(f"{BASE_URL}/teams", headers=headers_student1, json=team_data)
    if r.status_code == 201:
        team_id = r.json()["team_id"] # Fixed key
        join_code = r.json().get("join_code")
        ids["team_id"] = team_id
        ids["join_code"] = join_code
        success(f"Team created: {team_id}, Code: {join_code}")
    else:
        fail(f"Create team failed: {r.text}")
        return

    # Step 2: Get All Teams 
    r = requests.get(f"{BASE_URL}/teams", headers=headers_student1)
    if r.status_code == 200:
        # Check if our team is in the list
        data = r.json().get("teams", [])
        found = any(t["team_id"] == ids["team_id"] for t in data)
        if found:
            success("Team listed successfully")
        else:
            fail("Created team not found in list")
    else:
        fail(f"List teams failed: {r.text}")

    # Step 3: Join Team
    r = requests.post(f"{BASE_URL}/teams/{ids['team_id']}/join", params={"join_code": ids["join_code"]}, headers=headers_student2)
    if r.status_code == 200:
        success("Student 2 joined team")
    else:
        fail(f"Join team failed: {r.text}")

    # Step 5: Finalize
    r = requests.patch(f"{BASE_URL}/teams/{ids['team_id']}/finalize", headers=headers_lecturer)
    if r.status_code == 200:
        success("Team finalized")
    else:
        fail(f"Finalize team failed: {r.text}")

def flow_tasks():
    log("--- Flow 3: Task Management ---")
    headers_student1 = {"Authorization": f"Bearer {tokens['student1']}"}
    
    if "team_id" not in ids:
        fail("Skipping Flow 3 caused by Flow 2 failure")
        return

    # Step 1: Create Sprint
    params = {
        "team_id": ids["team_id"],
        "name": "Sprint 1",
        "start_date": "2026-01-28", # Re-enabled after backend fix
        "end_date": "2026-02-04"
    }
    r = requests.post(f"{BASE_URL}/tasks/sprints", params=params, headers=headers_student1)
    if r.status_code == 201:
        sprint_id = r.json()["sprint_id"] # Fixed key
        ids["sprint_id"] = sprint_id
        success(f"Sprint created: {sprint_id}")
    else:
        fail(f"Create sprint failed: {r.text}")
        return

    # Step 2: Create Tasks
    task_data = {
        "title": "Setup project structure",
        "sprint_id": ids["sprint_id"],
        "description": "Create folder structure",
        "priority": "HIGH"
    }
    r = requests.post(f"{BASE_URL}/tasks", json=task_data, headers=headers_student1)
    if r.status_code == 201:
        task_id = r.json()["task_id"] # Fixed key
        ids["task_id"] = task_id
        success(f"Task created: {task_id}")
    else:
        fail(f"Create task failed: {r.text}")
        return

    # Step 3: Get Tasks in Sprint
    r = requests.get(f"{BASE_URL}/tasks", params={"sprint_id": ids["sprint_id"]}, headers=headers_student1)
    if r.status_code == 200:
        data = r.json().get("tasks", [])
        found = any(t["task_id"] == ids["task_id"] for t in data)
        if found:
            success("Task listed in sprint")
        else:
            fail("Created task not found in sprint list")
    else:
        fail(f"List tasks failed: {r.text}")

    # Step 4: Update status
    r = requests.put(f"{BASE_URL}/tasks/{ids['task_id']}", json={"status": "DOING"}, headers=headers_student1)
    if r.status_code == 200:
        success("Task moved to DOING")
    else:
        fail(f"Update task failed: {r.text}")

def main():
    print("Waiting for server to be ready...")
    for i in range(10):
        try:
            requests.get(f"{BASE_URL}/health")
            break
        except:
            time.sleep(1)
            print(".", end="", flush=True)
    print("\nServer ready.")

    init_db()
    for k in users:
        register_user(k)
        login_user(k)
    
    if len(tokens) == 4:
        flow_topics()
        flow_teams()
        flow_tasks()
    else:
        fail("Could not log in all users, skipping flows")

if __name__ == "__main__":
    main()
