# 🧪 TEST IMPORT & REVERT FUNCTIONALITY

## 📂 Test Files Created:
1. `test_subjects_import.csv` - 5 test subjects (TEST001-TEST005)
2. `test_classes_import.csv` - 5 test classes (TEST001-01 to TEST004-01)
3. `test_users_import.csv` - 5 test users (test@university.edu)

---

## 🔬 TEST SCENARIO: SUBJECTS IMPORT & REVERT

### Step 1: Import Subjects
1. Go to Admin Dashboard → **Import Files** tab
2. Click **Upload File** on **Subjects** card
3. Select file: `test_subjects_import.csv`
4. Click **Import**
5. **Expected Result:**
   - ✅ 5 successful imports
   - 0 failed
   - 0 skipped

### Step 2: Verify Data in Supabase
1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to: Table Editor → **subjects**
3. **Check:** You should see 5 new subjects with codes TEST001-TEST005
4. **Note down the subject_ids** for verification after revert

### Step 3: View Import Details
1. In Import History table, click **👁️ View** button
2. **Verify Modal Shows:**
   - Total: 5
   - Successful: 5
   - Failed: 0
   - Detail table with all 5 rows showing SUCCESS status

### Step 4: Test Revert Function
1. In Import History table, click **↩️ Revert** button
2. **Confirm popup:**
   - Message: "This will delete 5 imported subjects"
   - Click **Yes, Revert**
3. **Expected Result:**
   - Loading message: "Reverting import..."
   - Success message: "Successfully reverted 5 out of 5 records"
   - History record automatically deleted

### Step 5: Verify Data Deleted from Supabase
1. Refresh Supabase Table Editor → **subjects**
2. **Check:** TEST001-TEST005 should be **DELETED**
3. **Result:** ✅ Revert successfully deleted data from database

---

## 🔬 TEST SCENARIO: CLASSES IMPORT & REVERT

### ⚠️ Prerequisites:
Before testing classes, ensure you have:
- ✅ Semester with code: **2026-SPRING** (in `semesters` table)
- ✅ Subjects with codes: **IT101, IT102, IT103** (in `subjects` table)
- ✅ Lecturer with email: **lecturer@example.com** (in `users` table with role=LECTURER)

### If Prerequisites Missing:
1. **Create Semester:** Admin Dashboard → Semesters → Add semester "2026-SPRING"
2. **Create Subjects:** Use template to import IT101, IT102, IT103
3. **Create Lecturer:** Use register to create user with role LECTURER

### Step 1-5: Same as Subjects Test
Follow same steps but use `test_classes_import.csv`
- Verify in Supabase table: **academic_classes**
- Check class_codes: TEST001-01 to TEST004-01

---

## 🔬 TEST SCENARIO: USERS IMPORT (Revert Disabled)

### Step 1: Import Users
1. Upload `test_users_import.csv`
2. **Expected:** 5 users created with default passwords

### Step 2: Verify in Supabase
1. Check Supabase → **users** table
2. Should see 5 new users with test emails

### Step 3: Try Revert (Should Fail)
1. Click **↩️ Revert** button
2. **Expected:** Button is **DISABLED** (greyed out)
3. **Hover tooltip:** "User deletion not supported yet"
4. **Reason:** Backend has no DELETE /users/{id} endpoint yet

---

## 📊 VERIFICATION CHECKLIST

### For Subjects:
- [ ] Import creates 5 records in database
- [ ] Import History shows correct counts
- [ ] View Details modal displays all rows
- [ ] Revert deletes all 5 records from Supabase
- [ ] History record removed after revert

### For Classes:
- [ ] Import creates 5 classes in database
- [ ] FK validation works (semester, subject, lecturer)
- [ ] Revert deletes all 5 classes from Supabase
- [ ] No orphaned records left

### For Users:
- [ ] Import creates 5 users in database
- [ ] Default passwords generated
- [ ] Revert button is DISABLED
- [ ] Delete History button still works (removes history only)

---

## 🐛 EXPECTED ERRORS (Valid Test Cases)

### If Import Fails:
1. **"Semester '2026-SPRING' not found"** → Create semester first
2. **"Subject with code 'IT101' not found"** → Create subjects first
3. **"Lecturer with email not found"** → Create lecturer user first
4. **"Email already exists"** → User already imported, will be skipped

### If Revert Fails:
1. **"Foreign key constraint violation"** → Classes still reference this subject
2. **"Record not found"** → Already deleted manually

---

## ✅ SUCCESS CRITERIA

**Revert function works correctly if:**
1. ✅ All imported records are deleted from Supabase
2. ✅ Success message shows correct count
3. ✅ History record is auto-removed
4. ✅ No orphaned data left in database
5. ✅ Can re-import same file after revert

---

## 🔧 TROUBLESHOOTING

### Data Still Exists After Revert?
1. Check browser console for errors
2. Check backend logs: `docker-compose logs backend --tail=50`
3. Verify IDs were captured during import (check importedIds array)

### Revert Shows "0 out of 5 records"?
- Check if records have FK constraints (e.g., classes referencing subject)
- Delete dependent records first (classes before subjects)

### Frontend Errors?
1. Open DevTools → Console
2. Look for API errors (401, 403, 500)
3. Check network requests in Network tab

---

## 📝 TEST REPORT TEMPLATE

```
Date: ___________
Tester: ___________

SUBJECTS IMPORT:
- Import Success: ☐ Yes ☐ No
- Database Verified: ☐ Yes ☐ No
- Revert Success: ☐ Yes ☐ No
- Data Deleted: ☐ Yes ☐ No

CLASSES IMPORT:
- Import Success: ☐ Yes ☐ No
- Database Verified: ☐ Yes ☐ No
- Revert Success: ☐ Yes ☐ No
- Data Deleted: ☐ Yes ☐ No

USERS IMPORT:
- Import Success: ☐ Yes ☐ No
- Database Verified: ☐ Yes ☐ No
- Revert Disabled: ☐ Yes ☐ No

BUGS FOUND:
1. ___________
2. ___________
3. ___________
```

---

## 🎯 NEXT STEPS AFTER TESTING

If all tests pass:
1. ✅ Import feature is production-ready
2. ✅ Revert feature works for subjects/classes
3. ⚠️ User revert needs DELETE endpoint implementation

If tests fail:
1. Check backend logs for errors
2. Verify database constraints
3. Report errors with screenshots
