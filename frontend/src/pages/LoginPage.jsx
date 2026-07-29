import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Typography, Divider } from 'antd';
import { GoogleOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { useAuth } from '../components/AuthContext';

const { Title, Text } = Typography;

const LoginPage = () => {
    const { login, loading, error, clearError } = useAuth();
    const [form] = Form.useForm();

    useEffect(() => {
        clearError();
    }, [clearError]);

    const onFinish = async (values) => {
        await login(values.email, values.password);
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafbfc' }}>
            <div style={{ maxWidth: 400, width: '100%', background: '#fff', padding: 32, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
                <Title level={2} style={{ textAlign: 'center', marginBottom: 8 }}>Login</Title>
                <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
                    Welcome back! Please login to your account.
                </Text>
                <Divider plain></Divider>
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
                        name="password"
                        label="Password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Enter password" size="large" />
                    </Form.Item>
                    {error && <Text type="danger">{error}</Text>}
                    <Form.Item style={{ marginTop: 16 }}>
                        <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                            Log in
                        </Button>
                    </Form.Item>
                </Form>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Text type="secondary">Don't have an account? </Text>
                    <Link to="/register">Register</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
