import React, { useState, useEffect } from 'react';
import { Layout, Typography, Button, Card, Col, Row, Select, Modal, Form, Input, message, Tag, DatePicker } from 'antd';
import { PlusOutlined, DeleteOutlined, CalendarOutlined, FlagOutlined } from '@ant-design/icons';
import { tasksService } from '../services/tasksService';
import { teamService } from '../services/api';
import MainLayout from '../components/MainLayout';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Content } = Layout;
const { Option } = Select;

const KanBanBoard = () => {
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [sprints, setSprints] = useState([]);
    const [currentSprintId, setCurrentSprintId] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(false);

    // Modal controls
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
    const [taskForm] = Form.useForm();
    const [sprintForm] = Form.useForm();

    // State for task modal sprints (separate from main sprints)
    const [taskModalSprints, setTaskModalSprints] = useState([]);

    const fetchSprints = async () => {
        if (!selectedTeamId) {
            console.log("No team selected");
            setSprints([]);
            setCurrentSprintId(null);
            setTasks([]);
            return;
        }

        console.log("Fetching sprints for team:", selectedTeamId);

        try {
            // Fetch sprints directly for the team
            const res = await tasksService.getTeamSprints(selectedTeamId);
            const teamSprints = res.data.sprints || [];
            console.log("Team sprints:", teamSprints);
            setSprints(teamSprints);

            // Select first sprint if none selected
            if (!currentSprintId && teamSprints.length > 0) {
                setCurrentSprintId(teamSprints[0].sprint_id || teamSprints[0].id);
            } else if (teamSprints.length === 0) {
                setCurrentSprintId(null);
                setTasks([]);
            }
        } catch (error) {
            console.error("Failed to fetch sprints", error);
            message.error("Failed to load sprints");
            setSprints([]);
            setCurrentSprintId(null);
            setTasks([]);
        }
    };

    const fetchTeams = async () => {
        try {
            const res = await teamService.getAll();
            console.log("Teams API response:", res.data);
            const userTeams = (res.data.teams || []).filter(t => t.is_member);
            console.log("User teams after filter:", userTeams);
            setTeams(userTeams);

            // Auto-select first team
            if (userTeams.length > 0 && !selectedTeamId) {
                setSelectedTeamId(userTeams[0].team_id || userTeams[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch teams", error);
            message.error("Failed to load teams. Please refresh the page.");
        }
    };

    const fetchSprintTasks = async (sprintId) => {
        setLoading(true);
        try {
            const res = await tasksService.getSprintTasks(sprintId);
            setTasks(res.data.tasks || []);
        } catch (error) {
            console.error("Failed to fetch sprint tasks", error);
            message.error("Failed to load tasks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial load
        fetchTeams();
    }, []);

    // Fetch sprints when team is selected
    useEffect(() => {
        if (selectedTeamId) {
            fetchSprints();
        }
    }, [selectedTeamId]);

    useEffect(() => {
        if (currentSprintId) {
            fetchSprintTasks(currentSprintId);
        } else {
            // Maybe fetch all if no sprint selected
            // fetchSprints loaded all tasks initially
        }
    }, [currentSprintId]);

    // Load sprints for task modal when it opens
    useEffect(() => {
        if (isTaskModalOpen && selectedTeamId) {
            tasksService.getTeamSprints(selectedTeamId).then(res => {
                setTaskModalSprints(res.data.sprints || []);
            }).catch(err => {
                console.error("Failed to fetch sprints for task modal", err);
                setTaskModalSprints([]);
            });
        }
    }, [isTaskModalOpen, selectedTeamId]);

    const handleCreateTask = async (values) => {
        try {
            const payload = {
                title: values.title,
                description: values.description,
                priority: values.priority,
                status: values.status,
                sprint_id: values.sprint_id || null,
                due_date: values.due_date ? values.due_date.toISOString() : null
            };
            await tasksService.createTask(payload);
            message.success('Task created successfully');
            setIsTaskModalOpen(false);
            taskForm.resetFields();
            setTaskModalSprints([]); // Clear task modal sprints

            // Refresh tasks if the created task belongs to current sprint
            if (values.sprint_id === currentSprintId) {
                fetchSprintTasks(currentSprintId);
            }
        } catch (error) {
            console.error("Create task error:", error);
            message.error(error.response?.data?.detail || 'Failed to create task');
        }
    };

    const handleCreateSprint = async (values) => {
        try {
            const payload = {
                team_id: values.team_id,
                name: values.name,
                goal: values.goal,
                start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
                end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null
            };
            const res = await tasksService.createSprint(payload);
            message.success('Sprint created successfully');
            setIsSprintModalOpen(false);
            sprintForm.resetFields();

            // Refresh sprints for the selected team
            if (selectedTeamId) {
                fetchSprints();
            }

            // Set the newly created sprint as current if it belongs to selected team
            if (res.data && res.data.sprint_id && res.data.team_id === selectedTeamId) {
                setCurrentSprintId(res.data.sprint_id);
            }
        } catch (error) {
            console.error("Create sprint error:", error);
            message.error(error.response?.data?.detail || 'Failed to create sprint');
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await tasksService.changeStatus(taskId, newStatus);
            message.success("Status updated");
            // Optimistic update
            setTasks(prev => prev.map(t => t.task_id === taskId ? { ...t, status: newStatus } : t));
        } catch (error) {
            message.error("Failed to update status");
        }
    };

    const handleDeleteTask = async (taskId) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this task?',
            content: 'This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    await tasksService.deleteTask(taskId);
                    message.success('Task deleted');
                    setTasks(prev => prev.filter(t => t.task_id !== taskId));
                } catch (error) {
                    message.error('Failed to delete task');
                }
            },
        });
    };

    const columns = ['TODO', 'DOING', 'DONE'];
    const columnTitles = {
        'TODO': 'To Do',
        'DOING': 'In Progress',
        'DONE': 'Done'
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'HIGH': return 'red';
            case 'MEDIUM': return 'orange';
            case 'LOW': return 'green';
            default: return 'blue';
        }
    };

    return (
        <MainLayout>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 'normal' }}>Kanban Board Detail</Title>
                <div style={{ display: 'flex', gap: 10 }}>
                    <Button onClick={() => setIsSprintModalOpen(true)}>New Sprint</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsTaskModalOpen(true)}>
                        New Task
                    </Button>
                </div>
            </div>

            {/* Team and Sprint controls */}
            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>Team:</span>
                <Select
                    style={{ width: 200 }}
                    placeholder="Select Team"
                    onChange={(teamId) => {
                        setSelectedTeamId(teamId);
                        setCurrentSprintId(null); // Reset sprint when team changes
                        setSprints([]); // Clear sprints
                        setTasks([]); // Clear tasks
                    }}
                    value={selectedTeamId}
                >
                    {teams.map(t => (
                        <Option key={t.team_id || t.id} value={t.team_id || t.id}>
                            {t.name || t.team_name}
                        </Option>
                    ))}
                </Select>

                <span style={{ fontWeight: 500, marginLeft: 16 }}>Sprint:</span>
                <Select
                    style={{ width: 200 }}
                    placeholder="Select Sprint"
                    onChange={setCurrentSprintId}
                    value={currentSprintId}
                    allowClear
                    disabled={!selectedTeamId}
                >
                    {sprints.map(s => <Option key={s.sprint_id || s.id} value={s.sprint_id || s.id}>{s.name || s.title || `Sprint ${s.sprint_id}`}</Option>)}
                </Select>
            </div>

            <Row gutter={16}>
                {columns.map(status => (
                    <Col span={8} key={status}>
                        <Card title={columnTitles[status]} style={{ background: '#f0f2f5', minHeight: 500 }} styles={{ body: { padding: '10px' } }}>
                            {tasks.filter(t => (t.status || 'TODO') === status).map(task => (
                                <Card
                                    key={task.task_id}
                                    style={{ marginBottom: 10, cursor: 'move' }}
                                    size="small"
                                    title={task.title}
                                    extra={
                                        <Button
                                            type="text"
                                            danger
                                            icon={<DeleteOutlined />}
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.task_id); }}
                                        />
                                    }
                                >
                                    <div style={{ marginBottom: 8, color: '#555' }}>{task.description}</div>

                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                                        <Tag icon={<FlagOutlined />} color={getPriorityColor(task.priority)}>
                                            {task.priority || 'MEDIUM'}
                                        </Tag>
                                        {task.due_date && (
                                            <Tag icon={<CalendarOutlined />} color="blue">
                                                {dayjs(task.due_date).format('MMM D')}
                                            </Tag>
                                        )}
                                    </div>

                                    <Select
                                        value={task.status}
                                        size="small"
                                        onChange={(val) => handleStatusChange(task.task_id, val)}
                                        style={{ width: '100%' }}
                                    >
                                        {columns.map(c => <Option key={c} value={c}>{columnTitles[c]}</Option>)}
                                    </Select>
                                </Card>
                            ))}
                        </Card>
                    </Col>
                ))}
            </Row>

            {/* Create Task Modal */}
            <Modal title="Create Task" open={isTaskModalOpen} onCancel={() => setIsTaskModalOpen(false)} onOk={() => taskForm.submit()}>
                <Form form={taskForm} layout="vertical" onFinish={handleCreateTask}>
                    <Form.Item
                        name="team_id"
                        label="Team"
                        rules={[{ required: true, message: 'Please select a team' }]}
                        initialValue={selectedTeamId}
                    >
                        <Select
                            placeholder="Select Team"
                            onChange={(teamId) => {
                                // Reset sprint when team changes
                                taskForm.setFieldsValue({ sprint_id: undefined });
                                // Fetch sprints for the selected team
                                tasksService.getTeamSprints(teamId).then(res => {
                                    setTaskModalSprints(res.data.sprints || []);
                                }).catch(err => {
                                    console.error("Failed to fetch sprints", err);
                                    setTaskModalSprints([]);
                                });
                            }}
                        >
                            {teams.map(t => (
                                <Option key={t.team_id || t.id} value={t.team_id || t.id}>
                                    {t.name || t.team_name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="sprint_id"
                        label="Sprint"
                        rules={[{ required: true, message: 'Please select a sprint' }]}
                    >
                        <Select placeholder="Select Sprint">
                            {taskModalSprints.map(s => (
                                <Option key={s.sprint_id || s.id} value={s.sprint_id || s.id}>
                                    {s.name || s.title || `Sprint ${s.sprint_id}`}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item name="description" label="Description"><Input.TextArea /></Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
                                <Select>
                                    <Option value="LOW">Low</Option>
                                    <Option value="MEDIUM">Medium</Option>
                                    <Option value="HIGH">High</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="status" label="Status" initialValue="TODO">
                                <Select>
                                    {columns.map(c => <Option key={c} value={c}>{columnTitles[c]}</Option>)}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item name="due_date" label="Due Date">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Create Sprint Modal */}
            <Modal title="Create Sprint" open={isSprintModalOpen} onCancel={() => setIsSprintModalOpen(false)} onOk={() => sprintForm.submit()}>
                <Form form={sprintForm} layout="vertical" onFinish={handleCreateSprint}>
                    <Form.Item
                        name="team_id"
                        label="Team"
                        rules={[{ required: true, message: 'Please select a team' }]}
                        initialValue={selectedTeamId}
                    >
                        <Select placeholder="Select Team">
                            {teams.map(t => (
                                <Option key={t.team_id || t.id} value={t.team_id || t.id}>
                                    {t.name || t.team_name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item name="name" label="Sprint Name" rules={[{ required: true, message: 'Please enter sprint name' }]}>
                        <Input placeholder="e.g., Sprint 1" />
                    </Form.Item>

                    <Form.Item name="goal" label="Sprint Goal">
                        <Input.TextArea placeholder="Describe the sprint goal" rows={3} />
                    </Form.Item>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="start_date"
                                label="Start Date"
                                rules={[{ required: true, message: 'Please select start date' }]}
                            >
                                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="end_date"
                                label="End Date"
                                rules={[{ required: true, message: 'Please select end date' }]}
                            >
                                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </MainLayout>
    );
};

export default KanBanBoard;
