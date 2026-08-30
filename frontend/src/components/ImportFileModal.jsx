import React, { useState } from 'react';
import {
  Modal, Upload, Button, Space, Progress, message, Table, Tag, 
  Statistic, Row, Col, Divider, Tabs, Empty, Alert
} from 'antd';
import {
  InboxOutlined, DownloadOutlined, CheckCircleOutlined, 
  ExclamationCircleOutlined, CloseCircleOutlined
} from '@ant-design/icons';

/**
 * ImportFileModal - Reusable component for importing data from CSV/Excel files
 * 
 * Props:
 *   - open: Boolean - Whether modal is open
 *   - onClose: Function - Called when modal closes
 *   - importType: 'subjects' | 'classes' | 'users' - Type of data to import
 *   - onImportComplete: Function - Called when import succeeds
 *   - apiService: Object - Service with import methods
 */
const ImportFileModal = ({ open, onClose, importType, onImportComplete, apiService }) => {
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Map of import types to API methods
  const importConfig = {
    subjects: {
      title: 'Import Subjects',
      description: 'Upload a CSV or Excel file with subject data',
      columns: ['subject_code', 'subject_name', 'credits', 'dept_name'],
    },
    classes: {
      title: 'Import Classes',
      description: 'Upload a CSV or Excel file with class data',
      columns: ['class_code', 'semester_code', 'subject_code', 'lecturer_email'],
    },
    users: {
      title: 'Import Users',
      description: 'Upload a CSV or Excel file with user data',
      columns: ['email', 'full_name', 'role_name', 'dept_name (optional)', 'phone (optional)'],
    },
  };

  const config = importConfig[importType] || {};

  const handleDownloadTemplate = async () => {
    try {
      await apiService.downloadTemplate(importType);
      message.success('Template downloaded successfully');
    } catch (err) {
      message.error('Failed to download template');
      console.error(err);
    }
  };

  const handleFileChange = ({ fileList: newFileList }) => {
    // Only keep the latest file
    setFileList(newFileList.slice(-1));
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('Please select a file');
      return;
    }

    const file = fileList[0].originFileObj;
    setUploading(true);

    try {
      // Call appropriate API method based on importType
      let response;
      if (importType === 'subjects') {
        response = await apiService.importSubjects(file);
      } else if (importType === 'classes') {
        response = await apiService.importClasses(file);
      } else if (importType === 'users') {
        response = await apiService.importUsers(file);
      }

      setImportResult(response.data || response);
      
      // Show summary
      if (response.data?.successful > 0) {
        message.success(`${response.data?.successful} records imported successfully`);
      }
      if (response.data?.failed > 0) {
        message.warning(`${response.data?.failed} records failed`);
      }
      if (response.data?.skipped > 0) {
        message.info(`${response.data?.skipped} records skipped`);
      }

      // Clear file after successful upload
      setFileList([]);

      // Notify parent
      if (onImportComplete) {
        onImportComplete(response.data || response);
      }
    } catch (err) {
      message.error(err?.response?.data?.detail || err?.message || 'Import failed');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleModalClose = () => {
    setFileList([]);
    setImportResult(null);
    onClose();
  };

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'skipped':
        return 'default';
      default:
        return 'processing';
    }
  };

  // Results table columns
  const resultColumns = [
    {
      title: 'Row',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 60,
    },
    {
      title: 'Item',
      dataIndex: importType === 'subjects' ? 'subject_code' : importType === 'classes' ? 'class_code' : 'email',
      key: 'item',
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={
          status === 'success' ? <CheckCircleOutlined /> :
          status === 'error' ? <CloseCircleOutlined /> :
          status === 'skipped' ? <ExclamationCircleOutlined /> : null
        }>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Details',
      dataIndex: 'message',
      key: 'message',
      render: (msg) => <span style={{ fontSize: '12px', color: '#666' }}>{msg}</span>,
    },
  ];

  return (
    <Modal
      title={config.title}
      open={open}
      onCancel={handleModalClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      {!importResult ? (
        // Upload Form
        <div>
          <p style={{ marginBottom: 16 }}>{config.description}</p>

          <Alert
            message="Column Headers Required"
            description={`Your file must include these columns: ${config.columns?.join(', ')}`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <div style={{ marginBottom: 16 }}>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleDownloadTemplate}
              type="dashed"
            >
              Download Template ({importType})
            </Button>
          </div>

          <Upload.Dragger
            multiple={false}
            fileList={fileList}
            onChange={handleFileChange}
            beforeUpload={() => false}
            accept=".csv,.xlsx,.xls"
            maxCount={1}
            style={{ marginBottom: 16 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">
              Click or drag a CSV/Excel file here to upload
            </p>
            <p className="ant-upload-hint">
              Supported formats: CSV (.csv), Excel (.xlsx, .xls)
            </p>
          </Upload.Dragger>

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={handleModalClose}>Cancel</Button>
            <Button 
              type="primary" 
              onClick={handleUpload}
              loading={uploading}
              disabled={fileList.length === 0}
            >
              Import
            </Button>
          </Space>
        </div>
      ) : (
        // Results View
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Statistic
                title="Total"
                value={importResult.total_rows}
                valueStyle={{ color: '#8c8c8c' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Successful"
                value={importResult.successful}
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Failed"
                value={importResult.failed}
                valueStyle={{ color: '#f5222d' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Skipped"
                value={importResult.skipped}
                valueStyle={{ color: '#faad14' }}
              />
            </Col>
          </Row>

          <Divider />

          {importResult.failed > 0 && (
            <Alert
              message={`${importResult.failed} records failed to import`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {importResult.results && importResult.results.length > 0 ? (
            <Table
              columns={resultColumns}
              dataSource={importResult.results}
              rowKey="row_number"
              pagination={{ pageSize: 10 }}
              size="small"
              style={{ marginBottom: 16 }}
            />
          ) : (
            <Empty description="No details available" style={{ marginBottom: 16 }} />
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setImportResult(null)}>Import Another File</Button>
            <Button type="primary" onClick={handleModalClose}>Done</Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default ImportFileModal;
