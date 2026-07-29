import React, { useEffect, useState } from 'react';
import { resolveRoleName, useAuth } from '../components/AuthContext';
import { teamService } from '../services/api';
import MentoringDashboard from '../components/MentoringDashboard';
import LecturerLayout from '../components/LecturerLayout';
import './MentoringPage.css';

const MentoringPage = () => {
    const { user } = useAuth();
    const [teams, setTeams] = useState([]);

    useEffect(() => {
        const fetchTeams = async () => {
            if (!user) return;
            try {
                const res = await teamService.getAll();
                const list = res.data?.teams || res.data || [];
                const roleName = resolveRoleName(user);
                const filtered = roleName === 'STUDENT'
                    ? list.filter((t) => t.is_member)
                    : list;
                setTeams(filtered);
            } catch (_err) {
                setTeams([]);
            }
        };
        fetchTeams();
    }, [user]);

    return (
        <LecturerLayout>
            <div className="mentoring-page mentoring-page__content">
                <MentoringDashboard teams={teams} />
            </div>
        </LecturerLayout>
    );
};

export default MentoringPage;
