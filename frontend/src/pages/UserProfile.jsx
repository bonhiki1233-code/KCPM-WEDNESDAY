import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Row, Col, Typography, Button, Card, Avatar, Form, Input, Divider, message, Modal, Space, Tag } from 'antd';
import { ArrowLeftOutlined, EditOutlined, UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';

import { useAuth, resolveRoleName, getDefaultDashboardPath } from '../components/AuthContext';
import { profileService } from '../services/api';

const { Title, Text } = Typography;

const UserProfile = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [formProfile] = Form.useForm();
  const [formPassword] = Form.useForm();

  const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  const buildScopedKey = (baseKey, userInfo) => {
    const identifier = userInfo?.user_id || userInfo?.email || userInfo?.id;
    return identifier ? `${baseKey}_${identifier}` : null;
  };

  // Determine Role for display function
  const getDisplayRole = (u) => {
    const r = resolveRoleName(u);
    if (!r) return 'Student';
    // Convert ADMIN -> Admin, STAFF -> Staff etc.
    return r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  };

  // Khởi tạo state từ User Context hoặc Local Storage
  const [userData, setUserData] = useState(() => {
    // Priority: Context User -> Local Storage -> Default
    const roleName = getDisplayRole(user);
    return {
      name: user?.full_name || 'Tong duc huy',
      email: user?.email || 'Test@gmail.com',
      phone: user?.phone_number || '0495558839',
      role: roleName
    };
  });

  const [avatarUrl, setAvatarUrl] = useState(() => {
    return user?.avatar_url || null;
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const roles = [
    { name: 'Admin', dotColor: '#f5222d' },
    { name: 'Staff', dotColor: '#faad14' },
    { name: 'Lecturer', dotColor: '#1890ff' },
    { name: 'Student', dotColor: '#52c41a' },
    // Add Head_Dept mapping if needed, usually maps to Admin or Staff color? Let's assume Admin color for now or add new.
    { name: 'Head_dept', dotColor: '#722ed1' }
  ];

  // Update logic to find role case-insensitively
  const currentRole = roles.find(r => r.name.toLowerCase() === (userData.role || 'student').toLowerCase()) || roles.find(r => r.name === 'Student');

  // Sync with user context if it updates (e.g. on refresh/re-login)
  useEffect(() => {
    if (user) {
      setUserData(prev => ({
        ...prev,
        name: user.full_name || prev.name,
        email: user.email || prev.email,
        role: getDisplayRole(user)
      }));
    }
  }, [user]);

  // NEW: Fetch Profile from API
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await profileService.getMe();
        if (response.data) {
          const apiData = response.data;
          setUserData(prev => ({
            ...prev,
            name: apiData.full_name || apiData.name || prev.name,
            email: apiData.email || prev.email,
            phone: apiData.phone_number || apiData.phone || prev.phone,
            role: getDisplayRole(apiData) // Ensure role is updated if API returns it
          }));
          // Sync context
          updateUser(apiData);
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      }
    };
    fetchProfile();
  }, []);

  // Dispatch profile updated event without localStorage to avoid quota errors
  useEffect(() => {
    const payload = { ...userData, _owner: user?.email || null };
    window.dispatchEvent(new CustomEvent('profile-updated', { detail: { profile: payload } }));
  }, [userData]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Giới hạn 2MB
        return message.error('Ảnh quá lớn! Vui lòng chọn ảnh dưới 2MB.');
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;

        // Update local preview immediately
        setAvatarUrl(base64String);

        try {
          // Send to backend API
          const response = await profileService.updateMe({
            avatar_url: base64String
          });

          // Update context with response from backend
          if (response.data) {
            updateUser({ avatar_url: response.data.avatar_url || base64String });
          }

          message.success('Đã cập nhật ảnh đại diện mới!');
        } catch (error) {
          console.error('Failed to update avatar:', error);
          const detail = error.response?.data?.detail;
          let errorMsg = 'Không thể lưu ảnh. Vui lòng thử lại.';

          if (Array.isArray(detail)) {
            errorMsg = detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
          } else if (typeof detail === 'string') {
            errorMsg = detail;
          }

          message.error({ content: errorMsg, duration: 5 });
          // Revert local preview on error
          setAvatarUrl(user?.avatar_url || null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const onUpdateProfile = async (values) => {
    try {
      // Transform field names to match backend schema
      const payload = {
        full_name: values.name,  // Transform 'name' -> 'full_name'
        phone: values.phone,
        // email is read-only in backend, don't send it
      };

      const response = await profileService.updateMe(payload);
      const updatedData = response.data;

      setUserData(prev => ({
        ...prev,
        name: updatedData?.full_name || values.name,
        email: updatedData?.email || prev.email,  // Don't change email
        phone: updatedData?.phone || values.phone
      }));

      updateUser({
        full_name: updatedData?.full_name || values.name,
        email: updatedData?.email || user?.email,
        phone: updatedData?.phone || values.phone,
      });

      message.success('Cập nhật thông tin thành công!');
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
        return message.error('Mật khẩu xác nhận không trùng khớp!');
      }

      console.log("Đang đổi mật khẩu...", values);
      message.loading({ content: 'Đang xử lý...', key: 'updatable' });

      setTimeout(() => {
        message.success({ content: 'Đổi mật khẩu thành công!', key: 'updatable', duration: 2 });
        formPassword.resetFields();
      }, 1000);

    } catch (error) {
      //tự hiển thị lỗi
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', padding: '40px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <Title level={1} style={{ fontWeight: 600 }}>User profile & Settings</Title>
        <Divider />

        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(getDefaultDashboardPath(user))}
          style={{ marginBottom: 32, fontSize: '16px', padding: 0 }}
        >
          Back to dashboard
        </Button>

        <Row gutter={[24, 24]}>
          {/* Profile Overview Card */}
          <Col xs={24} lg={12}>
            <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none', height: '100%' }}>
              <Title level={4} style={{ marginBottom: 24 }}>Profile overview</Title>
              <Row gutter={16} align="middle">
                <Col span={10} style={{ textAlign: 'center' }}>
                  <Avatar size={140} shape="square" src={avatarUrl} icon={!avatarUrl && <UserOutlined />} style={{ borderRadius: 12, background: '#ccc' }} />
                  <Button size="small" style={{ marginTop: 12, borderRadius: 20 }} onClick={() => fileInputRef.current.click()}>Change avatar</Button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                </Col>
                <Col span={14}>
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <div><Text strong>Name:</Text><Text style={{ marginLeft: 8 }}>{userData.name}</Text></div>
                    <div><Text strong>Email:</Text><Text style={{ marginLeft: 8 }}>{userData.email}</Text></div>
                    <div><Text strong>Phone:</Text><Text style={{ marginLeft: 8 }}>{userData.phone}</Text></div>
                    <Button icon={<EditOutlined />} style={{ borderRadius: 20, marginTop: 10 }} onClick={() => { formProfile.setFieldsValue(userData); setIsEditModalOpen(true); }}>Edit profile</Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Password Card */}
          <Col xs={24} lg={12}>
            <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none', height: '100%' }}>
              <Title level={4} style={{ marginBottom: 24 }}>Change Password</Title>
              <Form form={formPassword} layout="horizontal" labelCol={{ span: 9 }}>
                <Form.Item label={<Text strong>Current password</Text>} name="current" rules={[{ required: true }]}><Input.Password style={{ borderRadius: 8 }} /></Form.Item>
                <Form.Item label={<Text strong>New password</Text>} name="new" rules={[{ required: true }]}><Input.Password style={{ borderRadius: 8 }} /></Form.Item>
                <Form.Item label={<Text strong>Confirm password</Text>} name="confirm" rules={[{ required: true }]}><Input.Password style={{ borderRadius: 8 }} /></Form.Item>
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <Button type="default" icon={<LockOutlined />} style={{ borderRadius: 20 }} onClick={handleUpdatePassword}>update password</Button>
                </div>
              </Form>
            </Card>
          </Col>
        </Row>

        {/* Roles Card */}
        <Row style={{ marginTop: 24 }}>
          <Col span={24}>
            <Card style={{ background: '#f5f5f5', borderRadius: 24, border: 'none' }}>
              <Title level={4} style={{ marginBottom: 20 }}>Assigned Roles</Title>
              <Space wrap size={12}>
                <Tag style={{ backgroundColor: 'white', color: 'black', borderRadius: 20, padding: '5px 18px', border: '1px solid #d9d9d9', fontSize: '14px' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: currentRole.dotColor, borderRadius: '50%', marginRight: 8 }} />
                  {currentRole.name}
                </Tag>
              </Space>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Edit Modal */}
      <Modal title="Edit Profile Information" open={isEditModalOpen} onCancel={() => setIsEditModalOpen(false)} onOk={() => formProfile.submit()}>
        <Form form={formProfile} layout="vertical" onFinish={onUpdateProfile}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item
            name="email"
            label="Email Address"
          >
            <Input prefix={<MailOutlined />} disabled />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[
              { required: true, message: 'Please input your phone number!' },
              { pattern: /^\d{9,10}$/, message: 'Phone number must be digits only and 9-10 characters long.' }
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default UserProfile;