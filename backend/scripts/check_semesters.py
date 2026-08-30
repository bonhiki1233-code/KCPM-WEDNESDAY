import asyncio
import httpx

BASE_URL = "http://127.0.0.1:8001/api/v1"
PASSWORD = "Password123!"
ADMIN_EMAIL = "admin1@collabsphere.com"

async def main():
    async with httpx.AsyncClient() as client:
        # Login
        res = await client.post(f"{BASE_URL}/auth/login", data={"username": ADMIN_EMAIL, "password": PASSWORD})
        token = res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # List Semesters
        print("\n--- All Semesters ---")
        res = await client.get(f"{BASE_URL}/semesters/", headers=headers)
        if res.status_code != 200:
            print(f"Error {res.status_code}: {res.text}")
        else:
            semesters = res.json()
            for sem in semesters:
                print(f"ID: {sem['semester_id']} | Code: {sem['semester_code']} | Status: {sem['status']}")

        # Get Current
        print("\n--- Current Active Semester ---")
        res = await client.get(f"{BASE_URL}/semesters/current", headers=headers)
        if res.status_code == 200:
            cur = res.json()
            print(f"Current: {cur['semester_code']}")
        else:
            print(f"Current: None (Status {res.status_code})")

if __name__ == "__main__":
    asyncio.run(main())
