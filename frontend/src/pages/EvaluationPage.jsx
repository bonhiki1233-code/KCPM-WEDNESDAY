import React, { useEffect, useMemo, useState } from 'react';
import { Card, InputNumber, Button, Space, message, Typography, List, Tag, Input, Divider } from 'antd';
import LecturerLayout from '../components/LecturerLayout';
import { useAuth } from '../components/AuthContext';
import './EvaluationPage.css';

const { Text, Title } = Typography;

const DEMO_STORAGE_KEY = 'lecturer_demo_grades';

const EvaluationPage = () => {
    const { user } = useAuth();
    const demoSubmissions = useMemo(() => ([
        {
            id: 'SUB-001',
            studentName: 'Nguyen Thi Lan',
            projectTitle: 'Smart Campus Assistant',
            submittedAt: '2026-01-28T10:24:00Z',
            checkpoint: 'Checkpoint 2',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/smart-campus.pdf',
            summary: 'Implemented voice search and the campus map module.'
        },
        {
            id: 'SUB-002',
            studentName: 'Tran Quang Minh',
            projectTitle: 'AI Study Planner',
            submittedAt: '2026-01-29T14:40:00Z',
            checkpoint: 'Checkpoint 2',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/study-planner.pdf',
            summary: 'Integrated calendar sync and reminder notifications.'
        },
        {
            id: 'SUB-003',
            studentName: 'Le Hoang Anh',
            projectTitle: 'Green Energy Dashboard',
            submittedAt: '2026-01-30T08:15:00Z',
            checkpoint: 'Checkpoint 2',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/energy-dashboard.pdf',
            summary: 'Delivered charts for energy usage with export feature.'
        },
        {
            id: 'SUB-004',
            studentName: 'Pham Gia Huy',
            projectTitle: 'Smart Attendance Tracker',
            submittedAt: '2026-01-30T13:05:00Z',
            checkpoint: 'Checkpoint 3',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/attendance-tracker.pdf',
            summary: 'Added face verification and exportable weekly reports.'
        },
        {
            id: 'SUB-005',
            studentName: 'Vo Minh Chau',
            projectTitle: 'Library Queue Optimizer',
            submittedAt: '2026-01-31T09:30:00Z',
            checkpoint: 'Checkpoint 1',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/library-queue.pdf',
            summary: 'Prototype for real-time queue forecasting and alerts.'
        },
        {
            id: 'SUB-006',
            studentName: 'Dang Thi Ha',
            projectTitle: 'Campus Safety Alerts',
            submittedAt: '2026-02-01T08:42:00Z',
            checkpoint: 'Checkpoint 2',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/safety-alerts.pdf',
            summary: 'Implemented incident map and SMS escalation workflow.'
        },
        {
            id: 'SUB-007',
            studentName: 'Nguyen Khang',
            projectTitle: 'Dorm Energy Monitor',
            submittedAt: '2026-02-01T16:10:00Z',
            checkpoint: 'Checkpoint 2',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/dorm-energy.pdf',
            summary: 'Connected sensor data stream and added usage ranking.'
        },
        {
            id: 'SUB-008',
            studentName: 'Hoang Tu Anh',
            projectTitle: 'Scholarship Matchmaker',
            submittedAt: '2026-02-02T11:20:00Z',
            checkpoint: 'Checkpoint 3',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/scholarship-match.pdf',
            summary: 'Built matching rules and ranking by eligibility score.'
        },
        {
            id: 'SUB-009',
            studentName: 'Bui Phuong Nam',
            projectTitle: 'Sports Facility Booker',
            submittedAt: '2026-02-03T07:50:00Z',
            checkpoint: 'Checkpoint 1',
            status: 'pending',
            fileUrl: 'https://example.com/submissions/facility-booker.pdf',
            summary: 'Implemented booking calendar and conflict detection.'
        }
    ]), []);

    const [selectedId, setSelectedId] = useState(demoSubmissions[0]?.id || null);
    const [grades, setGrades] = useState({});
    const [scoreInput, setScoreInput] = useState(null);
    const [feedbackInput, setFeedbackInput] = useState('');

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    setGrades(parsed);
                }
            }
        } catch (_err) {
            setGrades({});
        }
    }, []);

    useEffect(() => {
        const current = selectedId ? grades[selectedId] : null;
        setScoreInput(current?.score ?? null);
        setFeedbackInput(current?.feedback ?? '');
    }, [grades, selectedId]);

    const selectedSubmission = demoSubmissions.find((item) => item.id === selectedId);

    const gradedCount = useMemo(() => (
        Object.values(grades).filter((item) => item?.score !== null && item?.score !== undefined).length
    ), [grades]);

    const handleSaveGrade = () => {
        if (!selectedId) {
            message.warning('Select a submission first');
            return;
        }
        if (scoreInput === null || scoreInput === undefined) {
            message.warning('Score is required');
            return;
        }
        const nextGrades = {
            ...grades,
            [selectedId]: {
                score: scoreInput,
                feedback: feedbackInput,
                gradedAt: new Date().toISOString()
            }
        };
        setGrades(nextGrades);
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextGrades));
        message.success('Grade saved');
    };

    const handleClearGrade = () => {
        if (!selectedId) return;
        const nextGrades = { ...grades };
        delete nextGrades[selectedId];
        setGrades(nextGrades);
        window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(nextGrades));
        message.success('Grade cleared');
    };

    const greetingName = useMemo(() => {
        const raw = user?.full_name || user?.email || 'User';
        const parts = String(raw).trim().split(' ').filter(Boolean);
        return parts.length ? parts[0] : raw;
    }, [user]);

    return (
        <LecturerLayout>
            <div className="evaluation-page evaluation-page__content">
                <Card style={{ borderRadius: 16, marginBottom: 16 }}>
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Text type="secondary">Welcome back, {greetingName}.</Text>
                        <Title level={4} style={{ margin: 0 }}>Grading & Feedback</Title>
                        <Text type="secondary">Demo data for lecturer grading. Grades are saved locally.</Text>
                        <Space size="large">
                            <Text strong>Total submissions: {demoSubmissions.length}</Text>
                            <Text strong>Graded: {gradedCount}</Text>
                        </Space>
                    </Space>
                </Card>

                <div className="evaluation-page__grid">
                    <div className="evaluation-page__column">
                        <Card title="Student submissions" style={{ borderRadius: 16 }}>
                            <List
                                dataSource={demoSubmissions}
                                renderItem={(item) => {
                                    const isSelected = item.id === selectedId;
                                    const grade = grades[item.id];
                                    return (
                                        <List.Item
                                            onClick={() => setSelectedId(item.id)}
                                            className={isSelected ? 'evaluation-page__list-item--active' : ''}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <List.Item.Meta
                                                title={`${item.studentName} • ${item.projectTitle}`}
                                                description={`${item.checkpoint} • ${new Date(item.submittedAt).toLocaleString()}`}
                                            />
                                            <Space>
                                                {grade?.score !== undefined && grade?.score !== null ? (
                                                    <Tag color="green">Graded</Tag>
                                                ) : (
                                                    <Tag color="orange">Pending</Tag>
                                                )}
                                            </Space>
                                        </List.Item>
                                    );
                                }}
                            />
                        </Card>
                    </div>

                    <div className="evaluation-page__column">
                        <Card title="Submission details" style={{ borderRadius: 16 }}>
                            {selectedSubmission ? (
                                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                                    <div>
                                        <Text strong>Student</Text>
                                        <div>{selectedSubmission.studentName}</div>
                                    </div>
                                    <div>
                                        <Text strong>Project</Text>
                                        <div>{selectedSubmission.projectTitle}</div>
                                    </div>
                                    <div>
                                        <Text strong>Checkpoint</Text>
                                        <div>{selectedSubmission.checkpoint}</div>
                                    </div>
                                    <div>
                                        <Text strong>Submitted at</Text>
                                        <div>{new Date(selectedSubmission.submittedAt).toLocaleString()}</div>
                                    </div>
                                    <div>
                                        <Text strong>Summary</Text>
                                        <div>{selectedSubmission.summary}</div>
                                    </div>
                                    <div>
                                        <Text strong>File</Text>
                                        <div>
                                            <a href={selectedSubmission.fileUrl} target="_blank" rel="noreferrer">
                                                Open submission file
                                            </a>
                                        </div>
                                    </div>
                                    <Divider />
                                    <div>
                                        <Text strong>Score (0-10)</Text>
                                        <InputNumber
                                            min={0}
                                            max={10}
                                            step={0.5}
                                            value={scoreInput}
                                            onChange={setScoreInput}
                                            style={{ width: '100%', marginTop: 8 }}
                                        />
                                    </div>
                                    <div>
                                        <Text strong>Feedback</Text>
                                        <Input.TextArea
                                            rows={4}
                                            placeholder="Write feedback for the student"
                                            value={feedbackInput}
                                            onChange={(event) => setFeedbackInput(event.target.value)}
                                            style={{ marginTop: 8 }}
                                        />
                                    </div>
                                    <Space>
                                        <Button type="primary" onClick={handleSaveGrade}>Save grade</Button>
                                        <Button onClick={handleClearGrade}>Clear</Button>
                                    </Space>
                                </Space>
                            ) : (
                                <Text type="secondary">Select a submission to view details.</Text>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </LecturerLayout>
    );
};

export default EvaluationPage;
