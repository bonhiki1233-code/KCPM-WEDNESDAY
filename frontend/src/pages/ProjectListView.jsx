import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { Typography, Button, Table, Input, Card, List, message, Dropdown, Row, Col, Space } from 'antd';
import {
  SearchOutlined, DownOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons';

import { projectService, teamService } from '../services/api';
import { useAuth } from '../components/AuthContext';
import MainLayout from '../components/MainLayout';
import './StudentDashboard.css';

const { Title, Text } = Typography;

const ProjectListView = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamId = searchParams.get('teamId');
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [searchText, setSearchText] = useState('');
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Utility functions for localStorage
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

  const buildScopedKey = (baseKey, user) => {
    const identifier = user?.user_id || user?.email || user?.id;
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

  const writeActiveProjects = (items) => {
    if (!canUseStorage()) return;
    const payload = { _owner: user?.email || null, items };
    const scopedKey = buildScopedKey('active_projects', user);
    if (scopedKey) {
      window.localStorage.setItem(scopedKey, JSON.stringify(payload));
    }
    window.localStorage.setItem('active_projects', JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('active-projects-updated', { detail: { items } }));
  };

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const res = await projectService.getAll();
        const rawData = Array.isArray(res.data) ? res.data : [];
        const mappedData = rawData.map(item => {
          const topicTitle = item.topic || item.topic_title || item.project_name || 'Untitled Topic';
          const statusRaw = (item.status || '').toString().toLowerCase();
          const normalizedStatus = statusRaw === 'claimed' ? 'Claimed' : 'Available';
          return {
            ...item,
            key: item.id || item.project_id || item.key || Math.random().toString(),
            id: item.id || item.project_id,
            topic: topicTitle,
            proposer: item.proposer || item.proposer_name || item.created_by || 'Lecturer',
            date: item.date || (item.claimed_at ? dayjs(item.claimed_at).format('DD/MM/YYYY') : 'N/A'),
            status: normalizedStatus,
          };
        });
        setAllData(mappedData);
      } catch (error) {
        console.error("Failed to fetch projects", error);
        message.error("Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  const handleChooseProject = async (record) => {
    try {
      if (record.status === 'Claimed') {
        message.warning('This project is already claimed!');
        return;
      }

      await projectService.claim(record.id);
      message.success('Project claimed successfully!');

      // If we came from Team Detail, link this project to the team
      if (teamId) {
        try {
          await teamService.selectProject(teamId, record.id);
          message.success('Project linked to team successfully!');
          navigate(`/teams/${teamId}`);
        } catch (linkError) {
          console.error("Failed to link project to team", linkError);
          const errorMsg = linkError.response?.data?.detail || linkError.message || 'Failed to link project to team';
          message.error(errorMsg);
        }
      }

      // Update local state
      setAllData(prev => prev.map(item =>
        item.key === record.key ? { ...item, status: 'Claimed' } : item
      ));

      // Update localStorage
      const activeItems = readActiveProjects();
      const nextItem = {
        id: record.id || record.key,
        title: record.topic || record.title || 'Untitled Project',
        description: `${record.category || 'Project'} • ${record.date || 'N/A'}`,
        iconType: 'project',
      };
      const nextItems = activeItems.some((item) => String(item.id) === String(nextItem.id))
        ? activeItems
        : [nextItem, ...activeItems];
      writeActiveProjects(nextItems);

    } catch (error) {
      console.error(error);
      message.error('Failed to claim project');
    }
  };

  // Calendar logic
  const startDay = currentDate.startOf('month').day();
  const daysInMonth = currentDate.daysInMonth();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: startDay }, (_, i) => i);

  const nextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
  const prevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));

  // Remove duplicates
  const uniqueData = useMemo(() => {
    const seen = new Set();
    return allData.filter(item => {
      const duplicate = seen.has(item.key);
      seen.add(item.key);
      return !duplicate;
    });
  }, [allData]);

  const topics = [...new Set(uniqueData.map(item => item.topic))];

  // Search & filter logic
  const sortedDataSource = uniqueData
    .filter(item => {
      const searchKey = searchText.trim().toLowerCase();
      const matchesTopic = selectedCategory ? item.topic === selectedCategory : true;
      const matchesSearch = item.topic.toLowerCase().includes(searchKey);
      return matchesTopic && matchesSearch;
    })
    .sort((a, b) => {
      if (a.status === 'Claimed' && b.status !== 'Claimed') return 1;
      if (a.status !== 'Claimed' && b.status === 'Claimed') return -1;
      return a.topic.localeCompare(b.topic);
    });

  const handleMenuClick = (e) => {
    if (e.key === 'all') {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(e.key);
    }
  };

  const menuItems = [
    { key: 'all', label: 'All Topics' },
    ...topics.map(t => ({ key: t, label: t }))
  ];

  const menuProps = {
    items: menuItems,
    onClick: handleMenuClick
  };

  const columns = [
    { title: 'Proposer', dataIndex: 'proposer', key: 'proposer', width: 120 },
    { title: 'Topic title', dataIndex: 'topic', key: 'topic' },
    { title: 'Project ID', dataIndex: 'key', key: 'key', width: 100 },
    { title: 'Date started', dataIndex: 'date', key: 'date', width: 120 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100 },
    {
      title: 'Activity',
      key: 'activity',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          type="default"
          style={{
            background: record.status === 'Claimed' ? '#d9d9d9' : '#1890ff',
            color: record.status === 'Claimed' ? '#00000040' : '#fff',
            border: 'none',
            cursor: record.status === 'Claimed' ? 'not-allowed' : 'pointer'
          }}
          onClick={() => handleChooseProject(record)}
          disabled={record.status === 'Claimed'}
        >
          {record.status === 'Claimed' ? 'Claimed' : 'Choose'}
        </Button>
      )
    },
  ];

  const recentActivities = [
    'Smart Inventory System', 'AI Health Monitor', 'Smart Campus App', 'Drone Delivery'
  ];

  // Right sidebar content
  const rightSidebar = (
    <>
      {/* Calendar */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: '16px' }}>{currentDate.format('MMMM YYYY')}</Text>
          <Space>
            <Button size="small" type="text" icon={<LeftOutlined />} onClick={prevMonth} style={{ border: '1px solid #d9d9d9' }} />
            <Button size="small" type="text" icon={<RightOutlined />} onClick={nextMonth} style={{ border: '1px solid #d9d9d9' }} />
          </Space>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px' }}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <Text key={day} type="secondary" style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: 4 }}>{day}</Text>
          ))}

          {emptyDays.map(i => <div key={`empty-${i}`} style={{ height: '32px' }} />)}

          {daysArray.map(day => {
            const isToday = day === dayjs().date() && currentDate.isSame(dayjs(), 'month');
            return (
              <div
                key={day}
                className={`calendar-day${isToday ? ' calendar-day--today' : ''}`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Activities */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 12 }}>Recent activities</Title>
        <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '16px', minHeight: 150 }}>
          <List
            dataSource={recentActivities}
            renderItem={item => (
              <List.Item className="recent-activity-item">
                <Typography.Text style={{ fontSize: '14px' }}>{item}</Typography.Text>
              </List.Item>
            )}
          />
        </div>
        <div style={{ textAlign: 'right', marginTop: 8 }}>
          <Text className="recent-activity-cta">see more</Text>
        </div>
      </div>
    </>
  );

  return (
    <MainLayout rightSidebar={rightSidebar}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: '0 0 8px 0', fontWeight: 'normal' }}>Project List View</Title>
        <Text style={{ fontSize: '16px' }}>List of topics for students to choose</Text>
      </div>

      {/* Search and Filter */}
      <Row justify="end" gutter={16} style={{ marginBottom: 16 }}>
        <Col>
          <Input
            placeholder="Quick search topic title..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            style={{
              width: 300,
              borderRadius: 8,
              height: '40px',
              background: '#fff',
              border: '1px solid #d9d9d9'
            }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Col>
        <Col>
          <Dropdown menu={menuProps} trigger={['click']}>
            <Button style={{ background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6, height: '40px' }}>
              {selectedCategory ? selectedCategory : 'Sort by Topic title'} <DownOutlined />
            </Button>
          </Dropdown>
        </Col>
      </Row>

      {/* Table */}
      <Table
        loading={loading}
        dataSource={sortedDataSource}
        columns={columns}
        pagination={false}
        scroll={{ y: 600 }}
        rowClassName={(record, index) => index % 2 === 0 ? 'table-row-light' : 'table-row-light'}
        locale={{ emptyText: 'No projects available' }}
        style={{
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      />
      <style>{`
        .ant-table-thead > tr > th {
          background: #1890ff !important;
          color: white !important;
          font-weight: 600;
        }
      `}</style>
    </MainLayout>
  );
};

export default ProjectListView;
