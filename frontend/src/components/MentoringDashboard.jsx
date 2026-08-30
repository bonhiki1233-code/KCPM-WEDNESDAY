import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Select, Space, Typography, Button, message } from 'antd';
import { ReloadOutlined, RobotOutlined } from '@ant-design/icons';
import MentoringLogList from './MentoringLogList';
import AIRecommendations from './AIRecommendations';
import RequestMentoringModal from './RequestMentoringModal';
import { getTeamMentoringLogs, generateAISuggestions, getTeamProgress } from '../services/mentoringService';

const { Title, Text } = Typography;

const MentoringDashboard = ({ teams }) => {
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(null);
    const [aiSuggestions, setAiSuggestions] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);

    const teamOptions = useMemo(() => (teams || []).map((team) => ({
        label: team.name || team.team_name,
        value: team.id || team.team_id
    })), [teams]);

    useEffect(() => {
        if (!selectedTeamId && teamOptions.length) {
            setSelectedTeamId(teamOptions[0].value);
        }
    }, [teamOptions, selectedTeamId]);

    const fetchLogs = async () => {
        if (!selectedTeamId) return;
        setLoadingLogs(true);
        try {
            const data = await getTeamMentoringLogs(selectedTeamId);
            setLogs(Array.isArray(data) ? data : data?.data || data || []);
        } catch (error) {
            message.error(error?.response?.data?.detail || 'Failed to load mentoring logs');
        } finally {
            setLoadingLogs(false);
        }
    };

    const fetchProgress = async () => {
        if (!selectedTeamId) return;
        try {
            const data = await getTeamProgress(selectedTeamId);
            setProgress(data);
        } catch (_error) {
            setProgress(null);
        }
    };

    useEffect(() => {
        if (selectedTeamId) {
            fetchLogs();
            fetchProgress();
        }
    }, [selectedTeamId]);

    const handleGenerateAI = async (values) => {
        if (!selectedTeamId) return;
        setLoadingAI(true);
        try {
            const data = await generateAISuggestions(selectedTeamId, values);
            setAiSuggestions(data?.suggestions || '');
            await fetchLogs();
            message.success('AI suggestions generated');
            setIsModalOpen(false);
        } catch (error) {
            message.error(error?.response?.data?.detail || 'Failed to generate AI suggestions');
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ borderRadius: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <Title level={4} style={{ marginBottom: 4 }}>AI Mentoring Dashboard</Title>
                            <Text type="secondary">Request AI insights and review mentoring logs.</Text>
                        </div>
                        <Space>
                            <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(); fetchProgress(); }}>
                                Refresh
                            </Button>
                            <Button type="primary" icon={<RobotOutlined />} onClick={() => setIsModalOpen(true)}>
                                Request AI
                            </Button>
                        </Space>
                    </div>

                    <Select
                        value={selectedTeamId}
                        onChange={setSelectedTeamId}
                        options={teamOptions}
                        placeholder="Select team"
                        style={{ width: 280 }}
                    />
                </Space>
            </Card>

            <Row gutter={[16, 16]}>
                <Col xs={24} lg={8}>
                    <Card title="Team Progress" style={{ borderRadius: 16 }}>
                        {progress ? (
                            <Space direction="vertical">
                                <Text>Sprint velocity: {progress.sprint_velocity?.toFixed?.(1) || progress.sprint_velocity}%</Text>
                                <Text>Tasks: {progress.tasks_done}/{progress.tasks_total}</Text>
                                <Text>Days remaining: {progress.days_remaining}</Text>
                            </Space>
                        ) : (
                            <Text type="secondary">No progress data.</Text>
                        )}
                    </Card>
                </Col>
                <Col xs={24} lg={8}>
                    <AIRecommendations suggestions={aiSuggestions} loading={loadingAI} />
                </Col>
                <Col xs={24} lg={8}>
                    <MentoringLogList logs={logs} loading={loadingLogs} />
                </Col>
            </Row>

            <RequestMentoringModal
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onSubmit={handleGenerateAI}
                loading={loadingAI}
            />
        </div>
    );
};

export default MentoringDashboard;
