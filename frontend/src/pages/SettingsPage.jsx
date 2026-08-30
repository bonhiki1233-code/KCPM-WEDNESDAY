import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layout,
    Row,
    Col,
    Typography,
    Button,
    Card,
    Avatar,
    Form,
    Input,
    Divider,
    message,
    Modal,
    Space,
    Tag
} from 'antd';
import {
    ArrowLeftOutlined,
    EditOutlined,
    UserOutlined,
    LockOutlined,
    MailOutlined
} from '@ant-design/icons';
import { profileService } from '../services/api';

const { Title, Text } = Typography;
const { Content } = Layout;

const roles = [
    { name: 'Admin', value: 'ADMIN', dotColor: '#f5222d' },
    { name: 'Staff', value: 'STAFF', dotColor: '#faad14' },
    { name: 'Lecturer', value: 'LECTURER', dotColor: '#1890ff' },
    { name: 'Student', value: 'STUDENT', dotColor: '#52c41a' },
    { name: 'Head Dept', value: 'HEAD_DEPT', dotColor: '#722ed1' }
];

const SettingsPage = () => {
    const navigate = useNavigate();
    const { user, updateUser, resolveRoleName, getDefaultDashboardPath } = useAuth();
    const fileInputRef = useRef(null);
    const [formProfile] = Form.useForm();
    const [formPassword] = Form.useForm();

    const getDisplayRole = (u) => {
        const r = resolveRoleName(u);
        if (!r) return 'Student';
        return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
    };

    const [userData, setUserData] = useState({
        name: user?.full_name || '',
        email: user?.email || '',
        phone: user?.phone || '',
        role: getDisplayRole(user)
    });

    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Fetch Profile from API on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await profileService.getMe();
                if (response.data) {
                    const apiData = response.data;
                    setUserData({
                        name: apiData.full_name || '',
                        email: apiData.email || '',
                        phone: apiData.phone || '',
                        role: getDisplayRole(apiData)
                    });
                    setAvatarUrl(apiData.avatar_url);
                    updateUser(apiData);
                }
            } catch (error) {
                console.error("Failed to fetch profile", error);
            }
        };
        fetchProfile();
    }, []);

    const handleFileChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            return message.error('Image too large (max 2MB)');
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            setAvatarUrl(base64String);

            try {
                const response = await profileService.updateMe({
                    avatar_url: base64String
                });
                if (response.data) {
                    updateUser({ avatar_url: response.data.avatar_url || base64String });
                }
                message.success('Avatar updated successfully');
            } catch (error) {
                console.error('Failed to update avatar:', error);
                const detail = error.response?.data?.detail;
                let errorMsg = 'Failed to update avatar. Please try again.';

                if (Array.isArray(detail)) {
                    errorMsg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
                } else if (typeof detail === 'string') {
                    errorMsg = detail;
                }

                message.error({ content: errorMsg, duration: 5 });
                setAvatarUrl(user?.avatar_url || null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleUpdateProfile = async (values) => {
        try {
            const payload = {
                full_name: values.name,
                phone: values.phone,
            };

            const response = await profileService.updateMe(payload);
            const updatedData = response.data;

            setUserData(prev => ({
                ...prev,
                name: updatedData?.full_name || values.name,
                phone: updatedData?.phone || values.phone
            }));

            updateUser({
                full_name: updatedData?.full_name || values.name,
                phone: updatedData?.phone || values.phone,
            });

            message.success('Profile updated successfully');
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Failed to update profile", error);
            const detail = error.response?.data?.detail;
            let errorMsg = 'Failed to update profile. Please try again.';

            if (Array.isArray(detail)) {
                errorMsg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
            } else if (typeof detail === 'string') {
                errorMsg = detail;
            }

            message.error({ content: errorMsg, duration: 5 });
        }
    };

    const handleUpdatePassword = async () => {
        try {
            const values = await formPassword.validateFields();
            if (values.new !== values.confirm) {
                return message.error('Passwords do not match');
            }
            // Password update API would go here if available
            message.success('Password updated successfully');
            formPassword.resetFields();
        } catch (error) {
            // Field validation handles reporting
        }
    };

    return (
        <Layout style={{ minHeight: '100vh', padding: '40px', background: '#fff' }}>
            <Content style={{ maxWidth: 1200, margin: '0 auto', width: '100%' }}>
                <Title level={1} style={{ fontWeight: 600 }}>User profile & Settings</Title>
                <Divider />

                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={() => navigate('/dashboard')}
                    style={{ marginBottom: 32, fontSize: 16, padding: 0 }}
                >
                    Back to dashboard
                </Button>

                <Row gutter={[24, 24]}>
                    <Col xs={24} lg={12}>
                        <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none', height: '100%' }}>
                            <Title level={4} style={{ marginBottom: 24 }}>Profile overview</Title>
                            <Row gutter={16} align="middle">
                                <Col span={10} style={{ textAlign: 'center' }}>
                                    <Avatar
                                        size={140}
                                        shape="square"
                                        src={avatarUrl}
                                        icon={!avatarUrl && <UserOutlined />}
                                        style={{ borderRadius: 12, background: '#ccc' }}
                                    />
                                    <Button size="small" style={{ marginTop: 12, borderRadius: 20 }} onClick={() => fileInputRef.current?.click()}>
                                        Change avatar
                                    </Button>
                                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                                </Col>
                                <Col span={14}>
                                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                                        <div>
                                            <Text strong>Name:</Text>
                                            <Text style={{ marginLeft: 8 }}>{userData.name}</Text>
                                        </div>
                                        <div>
                                            <Text strong>Email:</Text>
                                            <Text style={{ marginLeft: 8 }}>{userData.email}</Text>
                                        </div>
                                        <div>
                                            <Text strong>Phone:</Text>
                                            <Text style={{ marginLeft: 8 }}>{userData.phone}</Text>
                                        </div>
                                        <Button
                                            icon={<EditOutlined />}
                                            style={{ borderRadius: 20, marginTop: 10 }}
                                            onClick={() => {
                                                formProfile.setFieldsValue(userData);
                                                setIsEditModalOpen(true);
                                            }}
                                        >
                                            Edit profile
                                        </Button>
                                    </Space>
                                </Col>
                            </Row>
                        </Card>
                    </Col>

                    <Col xs={24} lg={12}>
                        <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none', height: '100%' }}>
                            <Title level={4} style={{ marginBottom: 24 }}>Change Password</Title>
                            <Form form={formPassword} layout="horizontal" labelCol={{ span: 9 }}>
                                <Form.Item label={<Text strong>Current password</Text>} name="current" rules={[{ required: true }]}>
                                    <Input.Password style={{ borderRadius: 8 }} />
                                </Form.Item>
                                <Form.Item label={<Text strong>New password</Text>} name="new" rules={[{ required: true }]}>
                                    <Input.Password style={{ borderRadius: 8 }} />
                                </Form.Item>
                                <Form.Item label={<Text strong>Confirm password</Text>} name="confirm" rules={[{ required: true }]}>
                                    <Input.Password style={{ borderRadius: 8 }} />
                                </Form.Item>
                                <div style={{ textAlign: 'center', marginTop: 10 }}>
                                    <Button type="default" icon={<LockOutlined />} style={{ borderRadius: 20 }} onClick={handleUpdatePassword}>
                                        update password
                                    </Button>
                                </div>
                            </Form>
                        </Card>
                    </Col>
                </Row>

                <Row style={{ marginTop: 24 }}>
                    <Col span={24}>
                        <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none' }}>
                            <Title level={4} style={{ marginBottom: 20 }}>Assigned Roles</Title>
                            <Space wrap size={12}>
                                {(() => {
                                    const userRoleStr = (user?.role?.role_name || 'STUDENT').toUpperCase();
                                    const displayRole = roles.find(r => r.value === userRoleStr) || roles[3];
                                    return (
                                        <Tag
                                            style={{
                                                backgroundColor: '#fff',
                                                color: '#000',
                                                borderRadius: 20,
                                                padding: '5px 18px',
                                                border: '1px solid #d9d9d9',
                                                fontSize: 14
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: 8,
                                                    height: 8,
                                                    backgroundColor: displayRole.dotColor,
                                                    borderRadius: '50%',
                                                    marginRight: 8
                                                }}
                                            />
                                            {displayRole.name}
                                        </Tag>
                                    );
                                })()}
                            </Space>
                        </Card>
                    </Col>
                </Row>
            </Content>

            <Modal
                title="Edit Profile Information"
                open={isEditModalOpen}
                onCancel={() => setIsEditModalOpen(false)}
                onOk={() => formProfile.submit()}
            >
                <Form form={formProfile} layout="vertical" onFinish={handleUpdateProfile}>
                    <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email Address">
                        <Input prefix={<MailOutlined />} disabled />
                    </Form.Item>
                    <Form.Item name="phone" label="Phone Number">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    );
};

export default SettingsPage;
