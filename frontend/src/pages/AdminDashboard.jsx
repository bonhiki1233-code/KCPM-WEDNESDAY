import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Layout, Typography, Button, Table, Avatar, Space, Badge,
  Input, Row, Col, Tooltip, Modal, Form, InputNumber, Select, message, Menu, Tabs, Popover, Divider
} from 'antd';
import {
  SearchOutlined, UserOutlined, BookOutlined, TeamOutlined,
  EditOutlined, DeleteOutlined, PlusOutlined,
  MenuOutlined, ArrowLeftOutlined, SettingOutlined, BellOutlined,
  LogoutOutlined, CalendarOutlined, UploadOutlined
} from '@ant-design/icons';

// Import services
import { subjectService, classService, userService, topicService, semesterService, userServiceExtended, importService } from '../services/api';
import { useAuth } from '../components/AuthContext';
import ImportFilesTab from '../components/ImportFilesTab';

const { Title, Text } = Typography;
const { Header, Sider, Content } = Layout;
const { Option } = Select;

const AdminDashboard = () => {
  const [form] = Form.useForm();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('1');

  // Get user role (Admin=1, Staff=2, HeadDept=3)
  const userRoleId = user?.role_id;
  const userRoleName = user?.role_name?.toUpperCase();

  // Dropdown data for Class Management form
  const [lecturers, setLecturers] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.subject_id, subject])), [subjects]);
  const lecturerById = useMemo(() => new Map(lecturers.map((lecturer) => [lecturer.user_id, lecturer])), [lecturers]);

  // Notification State
  const [isNotificationOpen, setNotificationOpen] = useState(false);
  const notificationAnchorRef = useRef(null);

  const notifications = useMemo(() => ([
    {
      id: 1,
      title: 'System Update',
      description: 'System maintenance scheduled for 2 AM.',
      timeAgo: '1 hour ago',
    },
    {
      id: 2,
      title: 'New User Registered',
      description: 'User "John Doe" has set up an account.',
      timeAgo: '2 hours ago',
    },
    {
      id: 3,
      title: 'Server Load High',
      description: 'CPU usage exceeded 80% for 5 minutes.',
      timeAgo: '3 hours ago',
    },
  ]), []);

  const notificationContent = (
    <div style={{ width: 320 }}>
      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>Notifications</div>
      <Divider style={{ margin: '0 0 12px' }} />
      <div>
        {notifications.map((item, index) => (
          <div key={item.id} style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <Avatar shape="square" size={36} style={{ backgroundColor: '#f0f0f0', color: '#8c8c8c' }}>
                <BellOutlined />
              </Avatar>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Text strong style={{ display: 'block' }}>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{item.timeAgo}</Text>
                </div>
              </div>
            </div>
            {index !== notifications.length - 1 && <Divider style={{ margin: '12px 0' }} />}
          </div>
        ))}
      </div>
      <Divider style={{ margin: '8px 0 12px' }} />
      <Button type="link" block onClick={() => setNotificationOpen(false)}>
        View all Notifications
      </Button>
    </div>
  );

  // Trạng thái dữ liệu
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  // Trạng thái truy vấn
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  // Trạng thái Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState(null);

  // --- LẤY DỮ LIỆU ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Skip data fetching for Import Files tab
      if (selectedKey === '6') {
        setData([]);
        setLoading(false);
        return;
      }

      let res;
      const params = {
        skip: (pagination.current - 1) * pagination.pageSize,
        limit: pagination.pageSize,
        search: searchText
      };

      if (selectedKey === '1') {
        res = await subjectService.getAll(params);
      } else if (selectedKey === '2') {
        res = await classService.getAll(params);
      } else if (selectedKey === '3') {
        res = await userService.getAll(params);
      } else if (selectedKey === '4') {
        res = await topicService.getAll();
      } else if (selectedKey === '5') {
        res = await semesterService.getAll();
      }

      // Kiểm tra định dạng
      const resultData = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res?.data?.topics)
          ? res.data.topics
          : [];
      setData(resultData);

      // Vì backend chưa trả về tổng số lượng, nên ta giả lập phân trang hoặc giả định đơn giản
      // Để phân trang thực tế, phản hồi backend cần bao gồm tổng số.
      // Triển khai hiện tại trả về toàn bộ danh sách hoặc danh sách giới hạn.
      // Ta sẽ giả định độ dài dữ liệu là tổng số cho phiên bản đơn giản này trừ khi backend hỗ trợ đếm.
      const headerTotal = res?.headers?.['x-total-count'];
      const totalCount = headerTotal ? Number(headerTotal) : (res?.data?.total ?? resultData.length);
      setTotal(totalCount); // Placeholder, improving later

    } catch (err) {
      console.error("API Error:", err);
      message.error("Error: Unable to load data.");
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedKey, pagination.current, searchText]);

  // Fetch dropdown data for Class Management form
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        // Fetch lecturers (role_id = 4)
        const lecRes = await userService.getAll({ role_id: 4 });
        setLecturers(Array.isArray(lecRes.data) ? lecRes.data : []);
        
        // Fetch semesters
        const semRes = await semesterService.getAll();
        setSemesters(Array.isArray(semRes.data) ? semRes.data : []);
        
        // Fetch subjects
        const subRes = await subjectService.getAll({});
        setSubjects(Array.isArray(subRes.data) ? subRes.data : []);
      } catch (err) {
        console.error('Failed to fetch dropdown data:', err);
      }
    };
    fetchDropdownData();
  }, []);

  // --- HÀNH ĐỘNG ---
  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Confirm Delete?',
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          if (selectedKey === '1') await subjectService.delete(id);
          else if (selectedKey === '2') await classService.delete(id);
          else if (selectedKey === '5') await semesterService.delete(id);
          // Người dùng thường được vô hiệu hóa mềm, đang chờ triển khai

          message.success('Deleted successfully');
          fetchData();
        } catch (err) {
          message.error(err.response?.data?.detail || err.message || "Failed to delete data!");
        }
      }
    });
  };

  const handleCreateOrUpdate = async (values) => {
    try {
      if (selectedKey === '1') {
        if (editingKey) await subjectService.update(editingKey, values);
        else await subjectService.create(values);
      } else if (selectedKey === '2') {
        if (editingKey) await classService.update(editingKey, values);
        else await classService.create(values);
      } else if (selectedKey === '5') {
        if (editingKey) await semesterService.update(editingKey, values);
        else await semesterService.create(values);
      }
      // Tạo người dùng thường liên quan đến nhiều logic hơn (mật khẩu), giữ đơn giản cho lúc này

      message.success(editingKey ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
      fetchData();
      // Refresh dropdown data for semesters
      if (selectedKey === '5') {
        const semRes = await semesterService.getAll();
        setSemesters(Array.isArray(semRes.data) ? semRes.data : []);
      }
    } catch (err) {
      message.error(err.response?.data?.detail || err.message || "Error: Please check input info.");
    }
  };

  // --- CỘT ---
  const handleTopicApproval = async (topicId, action) => {
    try {
      if (action === 'approve') {
        await topicService.approve(topicId);
        message.success('Topic approved');
      } else {
        await topicService.reject(topicId);
        message.success('Topic rejected');
      }
      fetchData();
    } catch (err) {
      message.error('Failed to update topic status');
    }
  };

  const handlePermissionToggle = async (record, checked) => {
    try {
      await userService.updateTopicPermission(record.user_id, checked);
      setData((prev) => prev.map((item) => (
        item.user_id === record.user_id ? { ...item, can_create_topics: checked } : item
      )));
      message.success('Permission updated');
    } catch (err) {
      message.error('Failed to update permission');
    }
  };

  // Toggle user active/inactive
  const handleUserToggleActive = async (record) => {
    try {
      await userServiceExtended.toggleActive(record.user_id);
      setData((prev) => prev.map((item) => (
        item.user_id === record.user_id ? { ...item, is_active: !item.is_active } : item
      )));
      message.success(`User ${record.is_active ? 'deactivated' : 'activated'} successfully`);
    } catch (err) {
      message.error('Failed to update user status');
    }
  };

  // Change semester status
  const handleSemesterStatusChange = async (record, newStatus) => {
    try {
      await semesterService.updateStatus(record.semester_id, newStatus);
      fetchData();
      message.success(`Semester status changed to ${newStatus}`);
    } catch (err) {
      message.error(err.response?.data?.detail || err.message || 'Failed to update semester status');
    }
  };

  // Get display role name
  const getDisplayRoleName = () => {
    if (userRoleId === 1) return 'Administrator';
    else if (userRoleId === 2) return 'Staff';
    else if (userRoleId === 3) return 'Head of Department';
    return 'User';
  };

  // Get menu items based on user role
  const getMenuItemsByRole = () => {
    const allItems = [
      { key: '1', icon: <BookOutlined />, label: 'Subject Management' },
      { key: '2', icon: <TeamOutlined />, label: 'Class Management' },
      { key: '3', icon: <UserOutlined />, label: 'User Management' },
      { key: '4', icon: <SettingOutlined />, label: 'Topic Approval' },
      { key: '5', icon: <CalendarOutlined />, label: 'Semester Management' },
      { key: '6', icon: <UploadOutlined />, label: 'Import Files' },
    ];

    // Admin (role_id=1): Full access
    if (userRoleId === 1) {
      return allItems;
    }
    // Staff (role_id=2): Subject, Class, User, Semester, Import Files (no Topic Approval)
    else if (userRoleId === 2) {
      return allItems.filter(item => ['1', '2', '3', '5', '6'].includes(item.key));
    }
    // HeadDept (role_id=3): Class, Subject, Topic Approval (no User, no Semester, no Import)
    else if (userRoleId === 3) {
      return allItems.filter(item => ['1', '2', '4'].includes(item.key));
    }

    return allItems; // Default fallback
  };

  // Get available keys for current role
  const getAvailableKeys = () => {
    const items = getMenuItemsByRole();
    return items.map(item => item.key);
  };

  // Reset selectedKey to first available if current is not in available
  React.useEffect(() => {
    const availableKeys = getAvailableKeys();
    if (!availableKeys.includes(selectedKey)) {
      setSelectedKey(availableKeys[0] || '1');
    }
  }, [userRoleId]);

  const getColumns = () => {
    const commonActions = {
      title: 'Actions',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => {
              setEditingKey(record.subject_id || record.class_id || record.user_id);
              form.setFieldsValue(record);
              setIsModalOpen(true);
            }} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.subject_id || record.class_id || record.user_id)} />
          </Tooltip>
        </Space>
      )
    };

    if (selectedKey === '1') { // MÔN HỌC
      return [
        { title: 'Course Code', dataIndex: 'subject_code', key: 'subject_code' },
        { title: 'Subject Name', dataIndex: 'subject_name', key: 'subject_name' },
        { title: 'Credits', dataIndex: 'credits', key: 'credits', align: 'center' },
        { title: 'Dept ID', dataIndex: 'dept_id', key: 'dept_id', align: 'center' },
        commonActions
      ];
    } else if (selectedKey === '2') { // LỚP HỌC
      return [
        { title: 'Class Code', dataIndex: 'class_code', key: 'class_code' },
        {
          title: 'Subject',
          key: 'subject',
          render: (_, record) => {
            const subject = subjectById.get(record.subject_id);
            if (subject) return `${subject.subject_code} - ${subject.subject_name}`;
            return record.subject_name || record.subject_id || 'N/A';
          }
        },
        {
          title: 'Lecturer',
          key: 'lecturer',
          render: (_, record) => {
            const lecturer = lecturerById.get(record.lecturer_id);
            if (lecturer) return `${lecturer.full_name}`;
            return record.lecturer_name || record.lecturer_id || 'N/A';
          }
        },
        commonActions
      ];
    } else if (selectedKey === '3') { // NGƯỜI DÙNG
      return [
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Full Name', dataIndex: 'full_name', key: 'full_name' },
        { title: 'Role', dataIndex: 'role_name', key: 'role_name' },
        {
          title: 'Topic Permission',
          key: 'can_create_topics',
          render: (_, record) => (
            <Space>
              {record.role_name?.toLowerCase() === 'lecturer' ? (
                <Button
                  size="small"
                  type={record.can_create_topics ? 'primary' : 'default'}
                  onClick={() => handlePermissionToggle(record, !record.can_create_topics)}
                >
                  {record.can_create_topics ? 'Allowed' : 'Blocked'}
                </Button>
              ) : (
                <Text type="secondary">N/A</Text>
              )}
            </Space>
          )
        },
        {
          title: 'Status',
          key: 'is_active',
          render: (_, record) => (
            <Button
              size="small"
              type={record.is_active ? 'primary' : 'default'}
              danger={record.is_active}
              onClick={() => handleUserToggleActive(record)}
            >
              {record.is_active ? 'Active' : 'Inactive'}
            </Button>
          )
        }
      ];
    } else if (selectedKey === '4') { // TOPIC APPROVAL
      return [
        { title: 'Title', dataIndex: 'title', key: 'title' },
        { title: 'Creator', dataIndex: 'created_by', key: 'created_by' },
        { title: 'Status', dataIndex: 'status', key: 'status' },
        {
          title: 'Actions',
          key: 'actions',
          render: (_, record) => (
            <Space>
              <Button
                size="small"
                type="primary"
                onClick={() => handleTopicApproval(record.topic_id, 'approve')}
                disabled={record.status === 'APPROVED'}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                disabled={record.status === 'REJECTED'}
                onClick={() => handleTopicApproval(record.topic_id, 'reject')}
              >
                Reject
              </Button>
            </Space>
          )
        }
      ];
    } else if (selectedKey === '5') { // SEMESTER MANAGEMENT
      return [
        { title: 'ID', dataIndex: 'semester_id', key: 'semester_id', width: 60 },
        { title: 'Semester Code', dataIndex: 'semester_code', key: 'semester_code' },
        { title: 'Semester Name', dataIndex: 'semester_name', key: 'semester_name' },
        {
          title: 'Status',
          key: 'status',
          render: (_, record) => {
            const statusColors = {
              'ACTIVE': 'green',
              'COMPLETED': 'gray',
              'UPCOMING': 'blue'
            };
            return (
              <Select
                value={record.status}
                size="small"
                style={{ width: 120 }}
                onChange={(value) => handleSemesterStatusChange(record, value)}
              >
                <Option value="ACTIVE"><Badge color="green" text="ACTIVE" /></Option>
                <Option value="COMPLETED"><Badge color="gray" text="COMPLETED" /></Option>
                <Option value="UPCOMING"><Badge color="blue" text="UPCOMING" /></Option>
              </Select>
            );
          }
        },
        {
          title: 'Actions',
          key: 'action',
          render: (_, record) => (
            <Space>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => {
                  setEditingKey(record.semester_id);
                  form.setFieldsValue(record);
                  setIsModalOpen(true);
                }} />
              </Tooltip>
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.semester_id)} />
              </Tooltip>
            </Space>
          )
        }
      ];
    }
    return [];
  };

  const getTitle = () => {
    switch (selectedKey) {
      case '1': return 'Subject Management';
      case '2': return 'Class Management';
      case '3': return 'User Management';
      case '4': return 'Topic Approval';
      case '5': return 'Semester Management';
      case '6': return 'Import Files';
      default: return 'Dashboard';
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={240} theme="light" collapsible collapsed={collapsed} trigger={null} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuOutlined /> : <ArrowLeftOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: '18px' }}
          />
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={(e) => { setSelectedKey(e.key); setPagination({ ...pagination, current: 1 }); }}
          items={getMenuItemsByRole()}
        />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <Title level={4} style={{ margin: 0 }}>CollabSphere Admin System</Title>
          <Space size="large">
            <div ref={notificationAnchorRef} style={{ display: 'inline-flex' }}>
              <Popover
                content={notificationContent}
                trigger="click"
                placement="bottomRight"
                open={isNotificationOpen}
                onOpenChange={setNotificationOpen}
                overlayStyle={{ padding: 0 }}
                arrow={{ pointAtCenter: true }}
                getPopupContainer={() => notificationAnchorRef.current || document.body}
              >
                <Badge dot offset={[-5, 5]}>
                  <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
                </Badge>
              </Popover>
            </div>
            <Space>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
              <Text strong>{getDisplayRoleName()}</Text>
            </Space>
            <Button icon={<LogoutOutlined />} onClick={logout}>
              Sign out
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: '24px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', minHeight: '80vh' }}>
            <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
              <Col>
                <Title level={3} style={{ margin: 0 }}>{getTitle()}</Title>
              </Col>
              <Col>
                {selectedKey !== '6' && (
                  <Space>
                    <Input
                      placeholder="Search..."
                      prefix={<SearchOutlined />}
                      onChange={e => setSearchText(e.target.value)}
                      allowClear
                      style={{ width: 300, borderRadius: '6px' }}
                    />
                    {selectedKey !== '3' && selectedKey !== '4' && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingKey(null); form.resetFields(); setIsModalOpen(true); }} size="large">
                        Add New
                      </Button>
                    )}
                  </Space>
                )}
              </Col>
            </Row>

            {selectedKey === '6' ? (
              <ImportFilesTab apiService={importService} />
            ) : (
              <Table
                loading={loading}
                columns={getColumns()}
                dataSource={data}
                rowKey={(record) => record.subject_id || record.class_id || record.user_id || record.topic_id || record.semester_id}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: total,
                  onChange: (page, pageSize) => setPagination({ current: page, pageSize })
                }}
              />
            )}
          </div>
        </Content>
      </Layout>

      <Modal
        title={editingKey ? "Update Information" : "Add New"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); }}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
          {selectedKey === '1' && (
            <>
              <Form.Item name="subject_code" label="Subject Code" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="subject_name" label="Subject Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="dept_id" label="Dept ID" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="credits" label="Credits">
                <InputNumber style={{ width: '100%' }} min={0} max={10} />
              </Form.Item>
            </>
          )}
          {selectedKey === '2' && (
            <>
              <Form.Item name="class_code" label="Class Code" rules={[{ required: true }]}>
                <Input placeholder="e.g., IT101-01" />
              </Form.Item>
              <Form.Item name="semester_id" label="Semester" rules={[{ required: true }]}>
                <Select placeholder="Select semester">
                  {semesters.map(sem => (
                    <Option key={sem.semester_id} value={sem.semester_id}>
                      {sem.semester_code || `Semester ${sem.semester_id}`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="subject_id" label="Subject" rules={[{ required: true }]}>
                <Select placeholder="Select subject" showSearch optionFilterProp="children">
                  {subjects.map(sub => (
                    <Option key={sub.subject_id} value={sub.subject_id}>
                      {sub.subject_code} - {sub.subject_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="lecturer_id" label="Lecturer" rules={[{ required: true }]}>
                <Select placeholder="Select lecturer" showSearch optionFilterProp="children">
                  {lecturers.map(lec => (
                    <Option key={lec.user_id} value={lec.user_id}>
                      {lec.full_name} ({lec.email})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}
          {selectedKey === '5' && (
            <>
              <Form.Item name="semester_code" label="Semester Code" rules={[{ required: true }]}>
                <Input placeholder="e.g., 2026-SPRING" />
              </Form.Item>
              <Form.Item name="semester_name" label="Semester Name">
                <Input placeholder="e.g., Spring Semester 2026" />
              </Form.Item>
              <Form.Item name="start_date" label="Start Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
              <Form.Item name="end_date" label="End Date" rules={[{ required: true }]}>
                <Input type="date" />
              </Form.Item>
              <Form.Item name="status" label="Status" initialValue="UPCOMING">
                <Select>
                  <Option value="ACTIVE">ACTIVE</Option>
                  <Option value="COMPLETED">COMPLETED</Option>
                  <Option value="UPCOMING">UPCOMING</Option>
                </Select>
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Layout>
  );
};

export default AdminDashboard;