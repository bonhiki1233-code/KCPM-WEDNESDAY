-- CollabSphere Seed Data SQL
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/csvlvzkucubqlfnuuizk/sql
-- pass Password123!
-- Insert Roles
INSERT INTO roles (role_id, role_name) VALUES
(1, 'ADMIN'),
(2, 'STAFF'),
(3, 'HEAD_DEPT'),
(4, 'LECTURER'),
(5, 'STUDENT')
ON CONFLICT (role_id) DO NOTHING;

-- Insert Departments
INSERT INTO departments (dept_id, dept_name) VALUES
(1, 'Information Technology'),
(2, 'Computer Science')
ON CONFLICT (dept_id) DO NOTHING;

-- Insert Semester
INSERT INTO semesters (semester_id, semester_code, status) VALUES
(1, '2025-FALL', 'ACTIVE')
ON CONFLICT (semester_id) DO NOTHING;

-- Insert Subject
INSERT INTO subjects (subject_id, subject_code, subject_name, dept_id) VALUES
(1, 'IT101', 'Intro to IT', 1)
ON CONFLICT (subject_id) DO NOTHING;

-- Insert Users (password hash for "Password123!" using pbkdf2_sha256)
-- Hash: $pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g
INSERT INTO users (email, password_hash, full_name, role_id, dept_id, is_active) VALUES
-- Admins
('admin1@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Admin One', 1, NULL, true),
('admin2@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Admin Two', 1, NULL, true),
-- Staff
('staff1@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Staff One', 2, 1, true),
('staff2@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Staff Two', 2, 2, true),
('staff3@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Staff Three', 2, 1, true),
-- Heads of Department
('hod1@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Head of Department One', 3, 1, true),
('hod2@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Head of Department Two', 3, 2, true),
-- Lecturers
('lect1@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Lecturer One', 4, 1, true),
('lect2@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Lecturer Two', 4, 2, true),
-- Students
('student1@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Student One (Leader)', 5, 1, true),
('student2@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Student Two', 5, 1, true),
('student3@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Student Three', 5, 2, true),
('student4@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Student Four', 5, 2, true),
('student5@collabsphere.com', '$pbkdf2-sha256$29000$8V6L0bp3Tqk1xlhrDWHMuQ$0fHfXN.wVa8/6Lho5SWlRYVMKl5hMv46A8sSQHZQk/g', 'Student Five', 5, 1, true)
ON CONFLICT (email) DO NOTHING;

-- Insert Academic Class (using lecturer1's user_id)
DO $$
DECLARE
    lect1_id UUID;
BEGIN
    SELECT user_id INTO lect1_id FROM users WHERE email = 'lect1@collabsphere.com';
    
    INSERT INTO academic_classes (class_code, semester_id, subject_id, lecturer_id)
    VALUES ('IT101-01', 1, 1, lect1_id)
    ON CONFLICT (class_code) DO NOTHING;
END $$;

-- Insert Class Enrollments (enroll all 5 students)
DO $$
DECLARE
    class_rec RECORD;
    student_rec RECORD;
BEGIN
    SELECT class_id INTO class_rec FROM academic_classes WHERE class_code = 'IT101-01';
    
    FOR student_rec IN 
        SELECT user_id FROM users WHERE email IN (
            'student1@collabsphere.com',
            'student2@collabsphere.com',
            'student3@collabsphere.com',
            'student4@collabsphere.com',
            'student5@collabsphere.com'
        )
    LOOP
        INSERT INTO class_enrollments (class_id, student_id)
        VALUES (class_rec.class_id, student_rec.user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Insert Team with leader student1
DO $$
DECLARE
    class_rec RECORD;
    leader_id UUID;
    new_team_id INT;
    student_rec RECORD;
BEGIN
    SELECT class_id INTO class_rec FROM academic_classes WHERE class_code = 'IT101-01';
    SELECT user_id INTO leader_id FROM users WHERE email = 'student1@collabsphere.com';
    
    INSERT INTO teams (class_id, leader_id, team_name, join_code)
    VALUES (class_rec.class_id, leader_id, 'Team Alpha', 'TEAM123')
    ON CONFLICT DO NOTHING
    RETURNING team_id INTO new_team_id;
    
    -- If team already exists, get its ID
    IF new_team_id IS NULL THEN
        SELECT team_id INTO new_team_id FROM teams WHERE class_id = class_rec.class_id LIMIT 1;
    END IF;
    
    -- Insert team members
    FOR student_rec IN 
        SELECT user_id, email FROM users WHERE email IN (
            'student1@collabsphere.com',
            'student2@collabsphere.com',
            'student3@collabsphere.com',
            'student4@collabsphere.com',
            'student5@collabsphere.com'
        )
    LOOP
        INSERT INTO team_members (team_id, student_id, role, is_active)
        VALUES (
            new_team_id,
            student_rec.user_id,
            CASE WHEN student_rec.email = 'student1@collabsphere.com' THEN 'LEADER' ELSE 'MEMBER' END,
            true
        )
        ON CONFLICT (team_id, student_id) DO NOTHING;
    END LOOP;
END $$;

-- Verify results
SELECT 'Roles' as table_name, COUNT(*) as count FROM roles
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Semesters', COUNT(*) FROM semesters
UNION ALL
SELECT 'Subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'Academic Classes', COUNT(*) FROM academic_classes
UNION ALL
SELECT 'Class Enrollments', COUNT(*) FROM class_enrollments
UNION ALL
SELECT 'Teams', COUNT(*) FROM teams
UNION ALL
SELECT 'Team Members', COUNT(*) FROM team_members;

-- Show created accounts
SELECT 
    u.email,
    r.role_name,
    CASE WHEN tm.role = 'LEADER' THEN '(Team Leader)' ELSE '' END as team_role
FROM users u
JOIN roles r ON u.role_id = r.role_id
LEFT JOIN team_members tm ON u.user_id = tm.student_id
ORDER BY r.role_id, u.email;
