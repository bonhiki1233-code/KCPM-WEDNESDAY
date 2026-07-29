import apiClient from './apiClient';

export const studentTeamsService = {
    // List all teams
    listTeams: () => apiClient.get('/teams'),

    // List topics (for reference if needed)
    listTopics: () => apiClient.get('/topics'),

    // Create a new team
    createTeam: (payload) => apiClient.post('/teams', payload),

    // Get team details
    getTeam: (teamId) => apiClient.get(`/teams/${teamId}`),

    // Join team by specific ID and code (optional param)
    joinTeam: (teamId, joinCode) => apiClient.post(`/teams/${teamId}/join`, null, { params: { join_code: joinCode } }),

    // Global join by code (if supported, or we search then join)
    // Assuming backend has a global join endpoint or we filter teams.
    // For now, let's assume a common pattern: POST /teams/join { join_code: ... }
    // If not, frontend might need to find the team first. 
    // Let's implement providing the join_code to the global endpoint.
    joinTeamByCode: (joinCode) => apiClient.post('/teams/join', { join_code: joinCode }),

    // Leave team
    leaveTeam: (teamId) => apiClient.post(`/teams/${teamId}/leave`),
};

// Default export to match some import patterns if necessary, but named export is preferred
export default studentTeamsService;
