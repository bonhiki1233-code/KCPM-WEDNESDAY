import React, { useState, useEffect } from 'react';
import {
  Card, Button, Space, Row, Col, Divider, Empty, 
  Table, Tag, Tooltip, message, Alert, Modal, Popconfirm
} from 'antd';
import {
  UploadOutlined, DownloadOutlined, FileExcelOutlined, 
  TeamOutlined, BookOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ExclamationCircleOutlined,
  EyeOutlined, DeleteOutlined, RollbackOutlined
} from '@ant-design/icons';
import ImportFileModal from './ImportFileModal';
import { subjectService, classService } from '../services/api';

/**
 * ImportFilesTab - Tab component for importing Subjects, Classes, and Users
 * Used in AdminDashboard as the Import Files tab
 */
const ImportFilesTab = ({ apiService }) => {
  const [selectedImport, setSelectedImport] = useState(null); // 'subjects' | 'classes' | 'users'
  const [importHistory, setImportHistory] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [detailsModal, setDetailsModal] = useState({ visible: false, record: null });
  const [loading, setLoading] = useState(false);

  // Fetch import logs on component mount
  useEffect(() => {
    fetchImportLogs();
  }, []);

  const fetchImportLogs = async () => {
    try {
      setLoading(true);
      const response = await apiService.getLogs();
      const logs = response.data || [];
      
      // Transform backend data to frontend format
      const transformedLogs = logs.map(log => ({
        id: log.log_id,
        type: log.import_type,
        timestamp: new Date(log.created_at).toLocaleString(),
        total: log.total_rows,
        successful: log.successful,
        failed: log.failed,
        skipped: log.skipped,
        details: log.details ? JSON.parse(log.details) : [],
        importedIds: log.imported_ids ? JSON.parse(log.imported_ids) : [],
      }));
      
      setImportHistory(transformedLogs);
    } catch (error) {
      console.error('Error fetching import logs:', error);
      // If error (e.g., not authenticated), just keep empty history
    } finally {
      setLoading(false);
    }
  };

  const importTypes = [
    {
      key: 'subjects',
      title: 'Import Subjects',
      icon: <BookOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      description: 'Import multiple subjects with credits and department',
      columns: 'subject_code, subject_name, credits, dept_name',
      fileExample: 'subjects.csv',
      color: '#1890ff',
    },
    {
      key: 'classes',
      title: 'Import Classes',
      icon: <TeamOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      description: 'Import academic classes with semester, subject, and lecturer',
      columns: 'class_code, semester_code, subject_code, lecturer_email',
      fileExample: 'classes.csv',
      color: '#52c41a',
    },
    {
      key: 'users',
      title: 'Import Users',
      icon: <FileExcelOutlined style={{ fontSize: 32, color: '#faad14' }} />,
      description: 'Import user accounts (students, lecturers, staff)',
      columns: 'email, full_name, role_name, dept_name, phone',
      fileExample: 'users.csv',
      color: '#faad14',
    },
  ];

  const handleOpenImport = (importType) => {
    setSelectedImport(importType);
    setShowModal(true);
  };

  const handleImportComplete = async (result) => {
    // Extract IDs of successfully imported records for revert functionality
    const importedIds = result.results
      ?.filter(r => r.status === 'success')
      .map(r => r.subject_id || r.class_id || r.user_id)
      .filter(Boolean) || [];
    
    // Save to database
    try {
      const logData = {
        import_type: selectedImport,
        total_rows: result.total_rows,
        successful: result.successful,
        failed: result.failed,
        skipped: result.skipped,
        details: JSON.stringify(result.results),
        imported_ids: JSON.stringify(importedIds)
      };
      
      await apiService.saveLog(logData);
      
      // Refresh logs from database
      await fetchImportLogs();
      
      message.success(`Import completed: ${result.successful} imported, ${result.failed} failed`);
    } catch (error) {
      console.error('Error saving import log:', error);
      message.error('Import completed but failed to save log');
    }
  };

  const handleDownloadTemplate = async (importType) => {
    try {
      message.loading({ content: 'Downloading template...', key: 'download' });
      await apiService.downloadTemplate(importType);
      message.success({ content: 'Template downloaded successfully!', key: 'download' });
    } catch (error) {
      console.error('Download error:', error);
      message.error({ 
        content: error.response?.data?.detail || 'Failed to download template', 
        key: 'download' 
      });
    }
  };

  const handleDeleteHistory = async (recordId) => {
    try {
      await apiService.deleteLog(recordId);
      setImportHistory(importHistory.filter(h => h.id !== recordId));
      message.success('History record deleted');
    } catch (error) {
      console.error('Error deleting log:', error);
      message.error('Failed to delete history record');
    }
  };

  const handleRevertImport = async (record) => {
    try {
      message.loading({ content: 'Reverting import...', key: 'revert' });
      
      // Call API to delete imported records
      const { type, importedIds } = record;
      
      if (!importedIds || importedIds.length === 0) {
        message.warning({ content: 'No records to revert', key: 'revert' });
        return;
      }

      // Users cannot be deleted (no API endpoint yet)
      if (type === 'users') {
        message.warning({ 
          content: 'User deletion not supported yet. Please manually deactivate users.', 
          key: 'revert' 
        });
        return;
      }

      let deletedCount = 0;
      const errors = [];

      for (const id of importedIds) {
        try {
          if (type === 'subjects') {
            await subjectService.delete(id);
          } else if (type === 'classes') {
            await classService.delete(id);
          }
          deletedCount++;
        } catch (err) {
          errors.push(`ID ${id}: ${err.response?.data?.detail || err.message}`);
        }
      }

      if (deletedCount > 0) {
        message.success({ 
          content: `Successfully reverted ${deletedCount} out of ${importedIds.length} records`, 
          key: 'revert' 
        });
        
        // Remove from history after successful revert
        handleDeleteHistory(record.id);
      } else {
        message.error({ 
          content: 'Failed to revert any records. Check console for errors.', 
          key: 'revert' 
        });
        console.error('Revert errors:', errors);
      }
    } catch (error) {
      console.error('Revert error:', error);
      message.error({ 
        content: error.response?.data?.detail || 'Failed to revert import', 
        key: 'revert' 
      });
    }
  };

  const historyColumns = [
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const icons = {
          subjects: <BookOutlined />,
          classes: <TeamOutlined />,
          users: <FileExcelOutlined />,
        };
        const names = {
          subjects: 'Subjects',
          classes: 'Classes',
          users: 'Users',
        };
        return <Space>{icons[type]} {names[type]}</Space>;
      },
    },
    {
      title: 'Date & Time',
      dataIndex: 'timestamp',
      key: 'timestamp',
    },
    {
      title: 'Total Records',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
    },
    {
      title: 'Successful',
      dataIndex: 'successful',
      key: 'successful',
      render: (count) => <Tag color="success">{count}</Tag>,
      align: 'center',
    },
    {
      title: 'Failed',
      dataIndex: 'failed',
      key: 'failed',
      render: (count) => count > 0 ? <Tag color="error">{count}</Tag> : <Tag>0</Tag>,
      align: 'center',
    },
    {
      title: 'Skipped',
      dataIndex: 'skipped',
      key: 'skipped',
      render: (count) => count > 0 ? <Tag color="warning">{count}</Tag> : <Tag>0</Tag>,
      align: 'center',
    },
    {
      title: 'Status',
      dataIndex: 'failed',
      key: 'status',
      render: (failed) => {
        if (failed === 0) {
          return <Tag icon={<CheckCircleOutlined />} color="success">Success</Tag>;
        } else {
          return <Tag icon={<ExclamationCircleOutlined />} color="warning">Warnings</Tag>;
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button 
              type="link" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailsModal({ visible: true, record })}
            />
          </Tooltip>
          <Tooltip title="Revert Import">
            <Popconfirm
              title="Revert this import?"
              description={`This will delete ${record.successful} imported ${
                record.type === 'subjects' ? 'subjects' : 
                record.type === 'classes' ? 'classes' : 'users'
              }. ${record.type === 'users' ? 'Note: User revert not supported yet.' : 'This action cannot be undone!'}`}
              onConfirm={() => handleRevertImport(record)}
              okText="Yes, Revert"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              disabled={record.successful === 0 || record.type === 'users'}
            >
              <Button 
                type="link" 
                size="small"
                icon={<RollbackOutlined />}
                disabled={record.successful === 0 || record.type === 'users'}
              />
            </Popconfirm>
          </Tooltip>
          <Tooltip title="Delete History">
            <Popconfirm
              title="Delete this history record?"
              description="This only removes from history, not the imported data"
              onConfirm={() => handleDeleteHistory(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button 
                type="link" 
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Alert
        message="Import Staff Files"
        description="Upload CSV or Excel files to import subjects, classes, and user accounts in bulk. Download templates to ensure proper file format."
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <div style={{ marginBottom: 32 }}>
        <h3>Import Options</h3>
        <Row gutter={[24, 24]}>
          {importTypes.map((importType) => (
            <Col xs={24} sm={12} lg={8} key={importType.key}>
              <Card
                hoverable
                style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ marginBottom: 16 }}>
                      {importType.icon}
                    </div>
                    <h4 style={{ marginBottom: 8 }}>{importType.title}</h4>
                    <p style={{ color: '#666', fontSize: 12, marginBottom: 12 }}>
                      {importType.description}
                    </p>
                    <div style={{ 
                      backgroundColor: '#f5f5f5', 
                      padding: '8px 12px', 
                      borderRadius: '4px',
                      fontSize: 11,
                      marginBottom: 12,
                      textAlign: 'left'
                    }}>
                      <strong>Columns:</strong>
                      <div>{importType.columns}</div>
                    </div>
                  </div>

                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Tooltip title="Download CSV template for this import type">
                      <Button 
                        icon={<DownloadOutlined />}
                        block
                        type="dashed"
                        size="small"
                        onClick={() => handleDownloadTemplate(importType.key)}
                      >
                        Download Template
                      </Button>
                    </Tooltip>
                    <Button 
                      icon={<UploadOutlined />}
                      block
                      type="primary"
                      onClick={() => handleOpenImport(importType.key)}
                    >
                      Upload File
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      <Divider />

      <div>
        <h3>Import History</h3>
        {importHistory.length > 0 ? (
          <Table
            columns={historyColumns}
            dataSource={importHistory}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            loading={loading}
          />
        ) : (
          loading ? <Table loading={true} /> : <Empty description="No imports yet" />
        )}
      </div>

      {/* Import Modal */}
      {selectedImport && (
        <ImportFileModal
          open={showModal}
          onClose={() => setShowModal(false)}
          importType={selectedImport}
          onImportComplete={handleImportComplete}
          apiService={apiService}
        />
      )}

      {/* Details Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined />
            Import Details - {detailsModal.record?.type?.toUpperCase()}
          </Space>
        }
        open={detailsModal.visible}
        onCancel={() => setDetailsModal({ visible: false, record: null })}
        footer={[
          <Button key="close" onClick={() => setDetailsModal({ visible: false, record: null })}>
            Close
          </Button>
        ]}
        width={900}
      >
        {detailsModal.record && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <div><strong>Timestamp:</strong></div>
                <div>{detailsModal.record.timestamp}</div>
              </Col>
              <Col span={6}>
                <div><strong>Total:</strong></div>
                <Tag color="blue">{detailsModal.record.total}</Tag>
              </Col>
              <Col span={6}>
                <div><strong>Successful:</strong></div>
                <Tag color="success">{detailsModal.record.successful}</Tag>
              </Col>
              <Col span={6}>
                <div><strong>Failed:</strong></div>
                <Tag color="error">{detailsModal.record.failed}</Tag>
              </Col>
            </Row>
            
            <Divider />
            
            <Table
              dataSource={detailsModal.record.details || []}
              columns={[
                {
                  title: 'Row #',
                  dataIndex: 'row_number',
                  key: 'row_number',
                  width: 80,
                },
                {
                  title: 'Code/Email',
                  key: 'identifier',
                  render: (_, record) => 
                    record.subject_code || record.class_code || record.email || 'N/A',
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (status) => {
                    const colors = {
                      success: 'success',
                      error: 'error',
                      skipped: 'warning',
                    };
                    const icons = {
                      success: <CheckCircleOutlined />,
                      error: <CloseCircleOutlined />,
                      skipped: <ExclamationCircleOutlined />,
                    };
                    return (
                      <Tag color={colors[status]} icon={icons[status]}>
                        {status?.toUpperCase()}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Message',
                  dataIndex: 'message',
                  key: 'message',
                  ellipsis: { showTitle: false },
                  render: (message) => (
                    <Tooltip title={message}>
                      <span>{message}</span>
                    </Tooltip>
                  ),
                },
              ]}
              rowKey={(record, index) => `${record.row_number}-${index}`}
              pagination={{ pageSize: 10 }}
              size="small"
              scroll={{ y: 300 }}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ImportFilesTab;
