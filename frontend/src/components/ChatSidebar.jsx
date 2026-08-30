import React, { useMemo, useState } from 'react';
import { Card, Typography, Select, List, Button, Modal, Form, Input, Empty, Space } from 'antd';
import { PlusOutlined, MessageOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const ChatSidebar = ({
    teams,
    selectedTeamId,
    onTeamChange,
    channels,
    selectedChannelId,
    onSelectChannel,
    onCreateChannel,
    loadingChannels
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form] = Form.useForm();

    const teamOptions = useMemo(() => (teams || []).map((team) => ({
        label: team.name || team.team_name,
        value: team.team_id || team.id
    })), [teams]);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            await onCreateChannel(values);
            form.resetFields();
            setIsModalOpen(false);
        } catch (_err) {
            // handled by form validation
        }
    };

    return (
        <Card
            title={<Title level={5} style={{ margin: 0 }}>Channels</Title>}
            style={{ height: '100%', borderRadius: 16 }}
            styles={{ body: { padding: 16, display: 'flex', flexDirection: 'column', height: '100%' } }}
        >
            <div style={{ marginBottom: 16 }}>
                <Text type="secondary">Select team</Text>
                <Select
                    value={selectedTeamId}
                    onChange={onTeamChange}
                    placeholder="Choose a team"
                    style={{ width: '100%', marginTop: 8 }}
                    options={teamOptions}
                    disabled={!teamOptions.length}
                />
            </div>

            <Space style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
                <Text strong>Channels</Text>
                <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setIsModalOpen(true)}
                    disabled={!selectedTeamId}
                >
                    New
                </Button>
            </Space>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {!channels?.length ? (
                    <Empty description={loadingChannels ? 'Loading...' : 'No channels yet'} />
                ) : (
                    <List
                        dataSource={channels}
                        renderItem={(channel) => (
                            <List.Item
                                key={channel.id || channel.channel_id}
                                onClick={() => onSelectChannel(channel)}
                                style={{
                                    cursor: 'pointer',
                                    borderRadius: 8,
                                    padding: '8px 12px',
                                    background: (channel.id || channel.channel_id) === selectedChannelId ? 'rgba(24, 144, 255, 0.1)' : 'transparent'
                                }}
                            >
                                <List.Item.Meta
                                    avatar={<MessageOutlined style={{ fontSize: 16, color: '#1890ff' }} />}
                                    title={<Text>{channel.name}</Text>}
                                    description={<Text type="secondary" style={{ fontSize: 12 }}>{channel.description || 'No description'}</Text>}
                                />
                            </List.Item>
                        )}
                    />
                )}
            </div>

            <Modal
                title="Create new channel"
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handleSubmit}
                okText="Create"
            >
                <Form form={form} layout="vertical">
                    <Form.Item
                        name="name"
                        label="Channel name"
                        rules={[{ required: true, message: 'Please enter a channel name' }]}
                    >
                        <Input placeholder="e.g. General" />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input placeholder="Optional" />
                    </Form.Item>
                </Form>
            </Modal>
        </Card>
    );
};

export default ChatSidebar;
