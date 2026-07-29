import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Input, Form, List, Avatar, Space, Row, Col, Upload, message, Radio, Divider, Select } from 'antd';
import { UploadOutlined, GithubOutlined, FileTextOutlined, DeleteOutlined, CloudUploadOutlined, TeamOutlined, MenuOutlined, ProjectOutlined } from '@ant-design/icons';
import MainLayout from '../components/MainLayout';
import submissionService from '../services/submissionService';
import { teamService, projectService } from '../services/api';
import { useAuth } from '../components/AuthContext';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const SubmissionsPage = () => {
    const { user } = useAuth();
    const [submissionType, setSubmissionType] = useState('file'); // 'file' or 'github'
    const [fileList, setFileList] = useState([]);
    const [teams, setTeams] = useState([]);
    const [activeProjects, setActiveProjects] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [projectInfo, setProjectInfo] = useState({
        TeamName: '',
        teamMembers: '',
        description: '',
        githubLink: ''
    });
    const [loading, setLoading] = useState(false);

    // Mock recent activities (sidebar) - could be moved to MainLayout or fetched
    const recentActivities = [
        'Project1_abcdijk', 'Project1_abcdijk', 'Project1_abcdijk', 'Project1_abcdijk'
    ];

    useEffect(() => {
        const fetchUserTeams = async () => {
            if (!user) return;
            try {
                const res = await teamService.getAll();
                const userTeams = (res.data.teams || []).filter(t => t.is_member);
                setTeams(userTeams);
            } catch (error) {
                console.error("Failed to fetch teams", error);
            }
        };
        fetchUserTeams();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
        const readStoredUser = () => {
            if (!canUseStorage()) return null;
            const raw = window.localStorage.getItem('user');
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (_err) {
                return null;
            }
        };
        const buildScopedKey = (baseKey, userInfo) => {
            const identifier = userInfo?.user_id || userInfo?.email || userInfo?.id;
            return identifier ? `${baseKey}_${identifier}` : null;
        };
        const readActiveProjects = () => {
            if (!canUseStorage()) return [];
            const storedUser = readStoredUser();
            const scopedKey = buildScopedKey('active_projects', storedUser || user);
            const scopedRaw = scopedKey && window.localStorage.getItem(scopedKey);
            const raw = scopedRaw || window.localStorage.getItem('active_projects');
            if (!raw) return [];
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && Array.isArray(parsed.items)) {
                    if (!scopedRaw && parsed._owner && storedUser?.email && parsed._owner !== storedUser.email) {
                        return [];
                    }
                    return parsed.items;
                }
                return [];
            } catch (_err) {
                return [];
            }
        };

        const items = readActiveProjects().map((item) => ({
            id: item.id,
            title: item.title || 'Untitled Project'
        }));
        setActiveProjects(items);
    }, [user]);

    const handleProjectChange = async (value) => {
        const teamId = value;
        setSelectedTeamId(teamId);

        const fallbackProject = typeof teamId === 'string' && teamId.startsWith('project:')
            ? activeProjects.find((p) => `project:${p.id}` === teamId)
            : null;
        if (fallbackProject) {
            setSelectedTeamId(null);
            setProjectInfo(prev => ({
                ...prev,
                projectName: fallbackProject.title
            }));
            message.info('Create or join a team to submit this project.');
            return;
        }

        const selectedTeam = teams.find(t => t.team_id === teamId || t.id === teamId);
        if (selectedTeam) {
            const projName = selectedTeam.project?.topic || selectedTeam.project?.title || selectedTeam.name || selectedTeam.team_name || 'Unknown Project';
            let membersStr = '';
            if (selectedTeam.members && Array.isArray(selectedTeam.members)) {
                membersStr = selectedTeam.members.map(m => m.full_name || m.name || m.email).join(', ');
            } else {
                // If not details, might need to fetch detail
                try {
                    const detailRes = await teamService.getDetail(teamId);
                    const detail = detailRes.data;
                    if (detail.members) {
                        membersStr = detail.members.map(m => m.full_name || m.name || m.email).join(', ');
                    }
                } catch (e) {
                    console.error("failed to fetch team detail", e);
                }
            }

            setProjectInfo(prev => ({
                ...prev,
                projectName: projName,
                teamMembers: membersStr
            }));

            if (selectedTeam.project_id) {
                try {
                    const projectRes = await projectService.getDetail(selectedTeam.project_id);
                    const project = projectRes.data;
                    const displayName = project?.project_name || project?.topic_title || projName;
                    setProjectInfo(prev => ({
                        ...prev,
                        projectName: displayName
                    }));
                } catch (error) {
                    console.error('Failed to fetch project/milestones', error);
                }
            }
        }
    };

    const handleUploadChange = ({ fileList: newFileList }) => {
        setFileList(newFileList);
    };

    const handleFormChange = (changedValues, allValues) => {
        setProjectInfo(prev => ({ ...prev, ...changedValues }));
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Validate
            if (!selectedTeamId) {
                message.error('Please select a project/team');
                setLoading(false);
                return;
            }
            if (!projectInfo.description || !projectInfo.description.trim()) {
                message.error('Please enter description');
                setLoading(false);
                return;
            }
            if (submissionType === 'file' && fileList.length === 0) {
                message.error('Please upload a file');
                setLoading(false);
                return;
            }
            if (submissionType === 'github' && !projectInfo.githubLink) {
                message.error('Please enter GitHub link');
                setLoading(false);
                return;
            }

            let fileUrl = null;
            if (submissionType === 'file') {
                const fileObject = fileList[0]?.originFileObj || fileList[0];
                if (!fileObject) {
                    message.error('Missing file to upload');
                    setLoading(false);
                    return;
                }
                const uploadResult = await submissionService.uploadSubmissionFile(fileObject);
                fileUrl = uploadResult?.file_url || null;
            }

            const payload = {
                team_id: selectedTeamId,
                content: projectInfo.description.trim(),
                file_url: submissionType === 'github' ? projectInfo.githubLink : fileUrl,
            };

            try {
                await submissionService.createSubmission(payload);
                message.success('Submission submitted successfully!');
            } catch (createError) {
                const detail = createError?.response?.data?.detail || '';
                if (detail.includes('A submission already exists for this checkpoint')) {
                    const existingList = await submissionService.getSubmissions({ team_id: selectedTeamId, limit: 1 });
                    const existing = Array.isArray(existingList) ? existingList[0] : existingList?.[0];
                    if (!existing?.submission_id) {
                        throw createError;
                    }
                    await submissionService.updateSubmission(existing.submission_id, {
                        content: payload.content,
                        file_url: payload.file_url,
                    });
                    message.success('Submission updated successfully!');
                } else {
                    throw createError;
                }
            }
            // Reset or redirect
            setFileList([]);
        } catch (error) {
            console.error(error);
            const detail = error?.response?.data?.detail;
            message.error(detail || 'Failed to submit');
        } finally {
            setLoading(false);
        }
    };

    const uploadProps = {
        onRemove: (file) => {
            const index = fileList.indexOf(file);
            const newFileList = fileList.slice();
            newFileList.splice(index, 1);
            setFileList(newFileList);
        },
        beforeUpload: (file) => {
            setFileList([file]); // Allow only 1 file for now
            return false;
        },
        fileList,
    };

    return (
        <MainLayout>
            <div style={{ marginBottom: 24 }}>
                <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 'normal' }}>Submission Portal</Title>
                <Text style={{ fontSize: '16px' }}>Submit your project milestones via ZIP files or GitHub repository links</Text>
            </div>

            <Row gutter={24}>
                {/* Left Column: Upload */}
                <Col span={10}>
                    <Card
                        title={<Space><CloudUploadOutlined /> <span>Upload Submission</span></Space>}
                        style={{ borderRadius: 12, height: '100%', background: '#d9d9d9', border: 'none' }} // Grey background as per design
                        styles={{ header: { borderBottom: '1px solid #bfbfbf' }, body: { padding: 24 } }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                            <Radio.Group
                                value={submissionType}
                                onChange={(e) => setSubmissionType(e.target.value)}
                                buttonStyle="solid"
                                style={{ background: '#fff', padding: 4, borderRadius: 8 }}
                            >
                                <Radio.Button value="file" style={{ borderRadius: 6, border: 'none', boxShadow: 'none', background: submissionType === 'file' ? '#1890ff' : 'transparent', color: submissionType === 'file' ? '#fff' : '#000' }}>
                                    <FileTextOutlined /> Files Upload
                                </Radio.Button>
                                <Radio.Button value="github" style={{ borderRadius: 6, border: 'none', boxShadow: 'none', background: submissionType === 'github' ? '#1890ff' : 'transparent', color: submissionType === 'github' ? '#fff' : '#000' }}>
                                    <GithubOutlined /> Github Link
                                </Radio.Button>
                            </Radio.Group>
                        </div>

                        {submissionType === 'file' ? (
                            <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', border: '1px dashed #d9d9d9', height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                                <CloudUploadOutlined style={{ fontSize: 48, color: '#bfbfbf', marginBottom: 16 }} />
                                <Upload {...uploadProps}>
                                    <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>Drag & drop your project files here or click to browse</Text>
                                    <Button icon={<UploadOutlined />}>Browse Files</Button>
                                </Upload>
                                <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>Supported formats: ZIP, RAR, 7Z, PDF, DOCX ( Max 50MB )</Text>
                            </div>
                        ) : (
                            <div style={{ background: '#fff', borderRadius: 12, padding: 24, height: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Text strong style={{ marginBottom: 8 }}>GitHub Repository Link</Text>
                                <Input
                                    placeholder="https://github.com/username/repo"
                                    style={{ borderRadius: 8, padding: '10px' }}
                                    value={projectInfo.githubLink}
                                    onChange={(e) => setProjectInfo({ ...projectInfo, githubLink: e.target.value })}
                                />
                                <div style={{ marginTop: 24 }}>
                                    <Text strong style={{ marginBottom: 8, display: 'block' }}>Branch (Optional)</Text>
                                    <Input placeholder="main" style={{ borderRadius: 8, padding: '10px', marginBottom: 16 }} />

                                    <Text strong style={{ marginBottom: 8, display: 'block' }}>Commit Hash (Optional)</Text>
                                    <Input placeholder="e.g. 8f3a2c1" style={{ borderRadius: 8, padding: '10px' }} />
                                </div>
                            </div>
                        )}

                        {/* File list preview if needed, though antd upload handles it */}
                        {submissionType === 'file' && fileList.length > 0 && (
                            <div style={{ marginTop: 16, background: '#fff', padding: 8, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Space>
                                    <FileTextOutlined style={{ color: '#1890ff' }} />
                                    <Text>{fileList[0].name}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>{(fileList[0].size / 1024 / 1024).toFixed(2)} MB</Text>
                                </Space>
                                <Button type="text" icon={<DeleteOutlined />} onClick={() => setFileList([])} danger />
                            </div>
                        )}

                    </Card>
                </Col>

                {/* Right Column: Submission Details */}
                <Col span={14}>
                    <Card
                        title={<Space><FileTextOutlined /> <span>Submission Details</span></Space>}
                        style={{ borderRadius: 12, height: '100%', background: '#d9d9d9', border: 'none' }}
                        styles={{ header: { borderBottom: '1px solid #bfbfbf' }, body: { padding: 24 } }}
                    >
                        <Form layout="vertical" onValuesChange={handleFormChange}>
                            <Form.Item label={<Space><ProjectOutlined /> <Text strong>Project Name</Text></Space>}>
                                <Select
                                    placeholder="Select a team/project"
                                    onChange={handleProjectChange}
                                    style={{ borderRadius: 8, height: 40 }}
                                >
                                    {(teams.length > 0 ? teams : activeProjects).map(item => {
                                        const isTeam = teams.length > 0;
                                        const value = isTeam ? (item.team_id || item.id) : `project:${item.id}`;
                                        const label = isTeam
                                            ? (item.project?.topic || item.project?.title || item.name || item.team_name || 'Unnamed Team')
                                            : (item.title || 'Untitled Project');
                                        return (
                                            <Select.Option key={value} value={value} disabled={!isTeam}>
                                                {label}
                                            </Select.Option>
                                        );
                                    })}
                                </Select>
                            </Form.Item>


                            <Form.Item label={<Space><TeamOutlined /> <Text strong>Team Members</Text></Space>}>
                                <Input
                                    placeholder="Member names"
                                    value={projectInfo.teamMembers}
                                    style={{ borderRadius: 8, height: 40, border: 'none' }}
                                    readOnly
                                />
                            </Form.Item>

                            <Form.Item label={<Space><MenuOutlined /> <Text strong>Description</Text></Space>}>
                                <TextArea
                                    rows={6}
                                    placeholder="Enter submission description..."
                                    value={projectInfo.description}
                                    onChange={(e) => setProjectInfo({ ...projectInfo, description: e.target.value })}
                                    style={{ borderRadius: 8, border: 'none', resize: 'none' }}
                                />
                            </Form.Item>

                            <div style={{ textAlign: 'center', marginTop: 32 }}>
                                <Button
                                    type="primary"
                                    size="large"
                                    onClick={handleSubmit}
                                    loading={loading}
                                    style={{ width: 200, height: 50, borderRadius: 8, background: '#fff', color: '#000', border: 'none', fontWeight: 600 }}
                                >
                                    Submit
                                </Button>
                            </div>
                        </Form>
                    </Card>
                </Col>
            </Row>
        </MainLayout>
    );
};
export default SubmissionsPage;
