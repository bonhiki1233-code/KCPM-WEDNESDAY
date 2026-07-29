import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, List, Avatar, Space, Modal, Slider, Input, message, Rate, Tag, Row, Col, Select, Empty } from 'antd';
import { UserOutlined, TeamOutlined, SaveOutlined, CheckCircleOutlined, FilterOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import peerReviewService from '../services/peerReviewService';
import { teamService } from '../services/api';
import { useAuth } from '../components/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const PeerReviewsPage = () => {
    const { user } = useAuth();
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(false);

    // Rating Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentReviewee, setCurrentReviewee] = useState(null);
    const [scores, setScores] = useState({
        collaboration: 3,
        communication: 3,
        contribution: 3,
    });
    const [comment, setComment] = useState('');
    const [submittedReviews, setSubmittedReviews] = useState(new Set());

    useEffect(() => {
        const fetchTeams = async () => {
            if (!user) return;
            try {
                const res = await teamService.getAll();
                const teamsData = res.data.teams || [];
                // Allow members to see teams they belong to
                const myTeams = teamsData.filter(t => t.is_member);
                setTeams(myTeams);

                if (myTeams.length > 0) {
                    setSelectedTeamId(myTeams[0].team_id || myTeams[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch teams", error);
                message.error("Failed to load teams");
            }
        };

        fetchTeams();
    }, [user]);

    useEffect(() => {
        if (!selectedTeamId) {
            setTeamMembers([]);
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch members
                const res = await teamService.getDetail(selectedTeamId);
                const members = (res.data.members || []).map(m => ({
                    ...m,
                    user_id: m.student_id || m.user_id || m.id,
                    role: m.role || (m.student_id === res.data.leader_id ? 'Leader' : 'Member')
                }));
                // Filter out self from review list (cannot review self)
                setTeamMembers(members.filter(m => m.user_id !== user.user_id && m.user_id !== user.id));

                // Fetch my submitted reviews to check progress
                // Use getTeamPeerReviews which returns reviews created by me
                const myReviewsRes = await peerReviewService.getTeamPeerReviews(selectedTeamId);
                // Filter to get unique reviewee_ids (since we only send 1 review per person now)
                const reviewedIds = new Set((myReviewsRes || []).map(r => r.reviewee_id));
                setSubmittedReviews(reviewedIds);

            } catch (error) {
                console.error("Failed to fetch team data", error);
                message.error("Failed to load team data");
            }
        };

        fetchData();
    }, [selectedTeamId]);

    const handleRateClick = (member) => {
        setCurrentReviewee(member);
        setScores({ collaboration: 3, communication: 3, contribution: 3 });
        setComment('');
        setIsModalOpen(true);
    };

    const handleModalOk = async () => {
        setLoading(true);
        try {
            // Calculate average score from 3 criteria
            const averageScore = Math.round(
                (scores.collaboration + scores.communication + scores.contribution) / 3
            );

            // Send one review with average score
            await peerReviewService.createPeerReview({
                team_id: selectedTeamId,
                reviewee_id: currentReviewee.user_id,
                criteria_name: "overall", // Use "overall" for average score
                score: averageScore,
                comment: comment || null
            });

            message.success(`Submitted review for ${currentReviewee.full_name || currentReviewee.name}`);
            setSubmittedReviews(prev => new Set(prev).add(currentReviewee.user_id));
            setIsModalOpen(false);
        } catch (error) {
            console.error('Peer review error:', error);
            message.error('Failed to submit review');
        } finally {
            setLoading(false);
        }
    };

    const handleModalCancel = () => {
        setIsModalOpen(false);
    };

    return (
        <MainLayout>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 'normal' }}>Peer Review Form</Title>
                <Text style={{ fontSize: '16px' }}>Rate and comment on your teammates</Text>
            </div>

            <Card style={{ borderRadius: 12, minHeight: 500 }} styles={{ body: { padding: 32 } }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <Title level={4} style={{ margin: 0 }}>Team Members</Title>
                    {teams.length > 0 && (
                        <Space>
                            <Text strong>Select Team:</Text>
                            <Select
                                value={selectedTeamId}
                                onChange={setSelectedTeamId}
                                style={{ width: 250 }}
                                placeholder="Select a team"
                            >
                                {teams.map(team => (
                                    <Option key={team.team_id || team.id} value={team.team_id || team.id}>{team.name}</Option>
                                ))}
                            </Select>
                        </Space>
                    )}
                </div>

                {teams.length === 0 ? (
                    <Empty description="You are not a member of any team to perform reviews." />
                ) : (
                    <List
                        itemLayout="horizontal"
                        dataSource={teamMembers}
                        renderItem={(item) => (
                            <List.Item
                                actions={[
                                    submittedReviews.has(item.user_id) ? (
                                        <Tag icon={<CheckCircleOutlined />} color="success">Rated</Tag>
                                    ) : (
                                        <Button type="default" shape="round" icon={<SaveOutlined />} onClick={() => handleRateClick(item)}>
                                            Rate
                                        </Button>
                                    )
                                ]}
                                style={{ padding: '16px 0', borderBottom: '1px solid #f0f0f0' }}
                            >
                                <List.Item.Meta
                                    avatar={<Avatar size={50} style={{ backgroundColor: '#f0f0f0', verticalAlign: 'middle' }} icon={<UserOutlined style={{ color: '#bfbfbf' }} />} />}
                                    title={<Text strong style={{ fontSize: 16 }}>{item.full_name}</Text>}
                                    description={
                                        <Space direction="vertical" size={0}>
                                            <Tag color="blue">{item.role}</Tag>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{item.email}</Text>
                                        </Space>
                                    }
                                />
                                <div style={{ marginRight: 48, textAlign: 'right', minWidth: 200 }}>
                                    <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Contact Info</Text>
                                    <Text style={{ fontSize: 14 }}>+84 0903449932</Text>
                                </div>
                            </List.Item>
                        )}
                    />
                )}
            </Card>

            {/* Evaluation Modal */}
            <Modal
                title={null}
                open={isModalOpen}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                footer={null}
                width={600}
                centered
                styles={{ body: { padding: 0, borderRadius: 12, overflow: 'hidden' } }}
            >
                <div style={{ background: '#f5f5f5', padding: '24px 24px 40px' }}>
                    <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>Peer Evaluation</Title>

                    {currentReviewee && (
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <Avatar size={64} style={{ marginBottom: 8 }} icon={<UserOutlined />} />
                            <Text strong style={{ display: 'block', fontSize: 18 }}>{currentReviewee.full_name}</Text>
                            <Text type="secondary">{currentReviewee.role}</Text>
                        </div>
                    )}

                    <Row gutter={[32, 24]} justify="center">
                        <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ background: '#fff', padding: '12px 24px', borderRadius: 20, border: '1px solid #d9d9d9', marginBottom: 16, display: 'inline-block' }}>Contribution</div>
                            <Slider
                                vertical={false}
                                min={1}
                                max={5}
                                value={scores.contribution}
                                onChange={(v) => setScores({ ...scores, contribution: v })}
                                marks={{ 1: '1', 5: '5' }}
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ background: '#fff', padding: '12px 24px', borderRadius: 20, border: '1px solid #d9d9d9', marginBottom: 16, display: 'inline-block' }}>Attitude</div>
                            <Slider
                                vertical={false}
                                min={1}
                                max={5}
                                value={scores.communication}
                                onChange={(v) => setScores({ ...scores, communication: v })}
                                marks={{ 1: '1', 5: '5' }}
                                style={{ width: '100%' }}
                            />
                        </Col>
                        <Col span={8} style={{ textAlign: 'center' }}>
                            <div style={{ background: '#fff', padding: '12px 24px', borderRadius: 20, border: '1px solid #d9d9d9', marginBottom: 16, display: 'inline-block' }}>Skill</div>
                            <Slider
                                vertical={false}
                                min={1}
                                max={5}
                                value={scores.collaboration}
                                onChange={(v) => setScores({ ...scores, collaboration: v })}
                                marks={{ 1: '1', 5: '5' }}
                                style={{ width: '100%' }}
                            />
                        </Col>
                    </Row>
                </div>

                <div style={{ padding: 24, background: '#fff' }}>
                    <TextArea
                        rows={4}
                        placeholder="Add a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        style={{ borderRadius: 8, marginBottom: 24, background: '#f0f0f0', border: 'none' }}
                    />
                    <Row gutter={16} justify="end">
                        <Col>
                            <Button size="large" onClick={handleModalCancel} style={{ borderRadius: 8 }}>Cancel</Button>
                        </Col>
                        <Col>
                            <Button size="large" type="primary" onClick={handleModalOk} loading={loading} style={{ borderRadius: 8 }}>Save</Button>
                        </Col>
                    </Row>
                </div>
            </Modal>
        </MainLayout>
    );
};

export default PeerReviewsPage;
