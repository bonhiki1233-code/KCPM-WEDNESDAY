import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Divider, Select } from 'antd';
import { GoogleOutlined, MailOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../components/AuthContext';

const { Title, Text } = Typography;

const RegisterPage = () => {
    const { register, loading, error, clearError } = useAuth();
    const [form] = Form.useForm();

    useEffect(() => {
        clearError();
    }, [clearError]);

    const onFinish = async (values) => {
        // Backend expects: email, password, role_id, (optional: full_name)
        const payload = {
            email: values.email,
            password: values.password,
            role_id: parseInt(values.role_id, 10),  // Convert string to int
            full_name: values.full_name || null,
        };
        await register(payload);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc' }}>
            <div style={{ maxWidth: 420, width: '100%', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <Title level={2} style={{ textAlign: 'center', marginBottom: 8 }}>Register</Title>
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
                    Create your account to get started
                </Text>
                <Button icon={<GoogleOutlined />} block style={{ marginBottom: 16 }} disabled>
                    Continue with Google
                </Button>
                <Divider plain>or</Divider>
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={onFinish}
                    requiredMark={false}
                >
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Please enter your email' },
                            { type: 'email', message: 'Invalid email address' },
                        ]}
                    >
                        <Input prefix={<MailOutlined />} placeholder="your.email@example.com" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="full_name"
                        label="Full Name"
                        rules={[]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Your full name (optional)" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                        hasFeedback
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Enter password" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="confirm"
                        label="Confirm your password"
                        dependencies={["password"]}
                        hasFeedback
                        rules={[
                            { required: true, message: 'Please confirm your password' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(new Error('Passwords do not match!'));
                                },
                            }),
                        ]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Confirm your password again" size="large" />
                    </Form.Item>
                    <Form.Item
                        name="role_id"
                        label="Role"
                        rules={[{ required: true, message: 'Please select your role' }]}
                    >
                        <Select placeholder="Select role" size="large">
                            <Select.Option value={1}>Admin</Select.Option>
                            <Select.Option value={2}>Staff</Select.Option>
                            <Select.Option value={3}>Head_Dept</Select.Option>
                            <Select.Option value={4}>Lecturer</Select.Option>
                            <Select.Option value={5}>Student</Select.Option>
                        </Select>
                    </Form.Item>
                    {error && <Text type="danger">{error}</Text>}
                    <Form.Item style={{ marginTop: 16 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Register
                        </Button>
                    </Form.Item>
                </Form>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Text type="secondary">Back to </Text>
                    <Link to="/login">Login</Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
