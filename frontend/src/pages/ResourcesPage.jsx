import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Card, Row, Col, Button, Modal, Form, Input, Select, Typography, Tag,
    Statistic, Progress, message, Popconfirm, Spin, Empty, Space, Tooltip, Upload, Table
} from 'antd';
import {
    UploadOutlined, FolderOutlined, FileTextOutlined, FilePdfOutlined,
    FileImageOutlined, VideoCameraOutlined, FileExcelOutlined, FilePptOutlined,
    CodeOutlined, LinkOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined
} from '@ant-design/icons';
import {
    getResources, createResource, deleteResource, uploadResourceFile,
    RESOURCE_TYPES, RESOURCE_TYPE_LABELS, detectResourceType, getResourceTypeInfo
} from '../services/resourceService';

const { Title, Text } = Typography;
const { Option } = Select;

// File type configurations with icons and colors
const FILE_TYPE_CONFIG = {
    document: { icon: <FileTextOutlined />, color: '#1890ff', bgColor: '#e6f7ff', label: 'Word' },
    pdf: { icon: <FilePdfOutlined />, color: '#f5222d', bgColor: '#fff1f0', label: 'PDF' },
    image: { icon: <FileImageOutlined />, color: '#52c41a', bgColor: '#f6ffed', label: 'Image' },
    video: { icon: <VideoCameraOutlined />, color: '#eb2f96', bgColor: '#fff0f6', label: 'Video' },
    spreadsheet: { icon: <FileExcelOutlined />, color: '#52c41a', bgColor: '#f6ffed', label: 'Excel' },
    presentation: { icon: <FilePptOutlined />, color: '#fa8c16', bgColor: '#fff7e6', label: 'PPT' },
    code: { icon: <CodeOutlined />, color: '#722ed1', bgColor: '#f9f0ff', label: 'Code' },
    link: { icon: <LinkOutlined />, color: '#13c2c2', bgColor: '#e6fffb', label: 'Link' },
    other: { icon: <FolderOutlined />, color: '#8c8c8c', bgColor: '#f5f5f5', label: 'Archive' }
};

const MOCK_RESOURCES = [
    { id: 1, resource_id: 1, title: 'Project_Requirements.pdf', resource_type: 'pdf', url: '#', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), description: '2.4 MB' },
    { id: 2, resource_id: 2, title: 'Architecture_Diagram.png', resource_type: 'image', url: '#', created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), description: '1.8 MB' },
    { id: 3, resource_id: 3, title: 'Meeting_Notes.docx', resource_type: 'document', url: '#', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), description: '450 KB' },
    { id: 4, resource_id: 4, title: 'Final_Report.docx', resource_type: 'document', url: '#', created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(), description: '1.2 MB' },
    { id: 5, resource_id: 5, title: 'Budget_Q3.xlsx', resource_type: 'spreadsheet', url: '#', created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), description: '850 KB' },
    { id: 6, resource_id: 6, title: 'Presentation_v2.pptx', resource_type: 'presentation', url: '#', created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), description: '5.4 MB' },
    { id: 7, resource_id: 7, title: 'Design_System.fig', resource_type: 'other', url: '#', created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), description: '12 MB' },
    { id: 8, resource_id: 8, title: 'API_Spec.json', resource_type: 'code', url: '#', created_at: new Date(Date.now() - 72 * 3600 * 1000).toISOString(), description: '120 KB' },
    { id: 9, resource_id: 9, title: 'Logo_Assets.zip', resource_type: 'other', url: '#', created_at: new Date(Date.now() - 168 * 3600 * 1000).toISOString(), description: '24 MB' }
];

const ResourcesPage = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [viewAllModalVisible, setViewAllModalVisible] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Fetch resources
    const fetchResources = useCallback(async () => {
        setLoading(true);
        try {
            const params = filterType !== 'all' ? { resource_type: filterType } : {};
            const response = await getResources(params);
            
            // Use resources from API directly (no fallback to mock)
            const apiResources = response.resources || [];
            console.log('📦 Raw API response:', apiResources.slice(0, 2)); // Log first 2 for debugging
            
            // Transform API response to match UI format
            const transformedResources = apiResources.map((r, idx) => {
                // Determine resource type - try multiple field names
                let resourceType = r.resource_type || r.file_type || 'other';
                
                // If type is not recognized, try to detect from URL
                if (!['document', 'pdf', 'link', 'video', 'image', 'presentation', 'spreadsheet', 'code', 'other'].includes(resourceType)) {
                    const detected = detectResourceType(r.url || r.file_url || 'unknown');
                    console.warn(`⚠️ Resource #${idx}: Type "${resourceType}" not recognized, detecting from URL → "${detected}"`);
                    resourceType = detected;
                }
                
                const transformed = {
                    id: r.resource_id,
                    resource_id: r.resource_id,
                    title: r.title || 'Untitled Resource',
                    resource_type: resourceType,
                    url: r.url || r.file_url,
                    created_at: r.created_at,
                    description: r.description || `Uploaded by ${r.uploader_name || 'Unknown'}`
                };
                
                if (idx < 3) {
                    console.log(`📦 Resource #${idx}:`, {
                        original_type: r.resource_type || r.file_type,
                        transformed_type: resourceType,
                        title: r.title,
                        url_preview: (r.url || r.file_url || 'none').substring(0, 50)
                    });
                }
                return transformed;
            });
            
            console.log(`✅ Transformed ${transformedResources.length} resources total`);
            setResources(transformedResources);
            
            if (transformedResources.length === 0) {
                message.info('No resources found. Upload your first resource!');
            }
        } catch (error) {
            console.error('Failed to fetch resources:', error);
            message.error('Failed to load resources');
            setResources([]); // Show empty state instead of mock data
        } finally {
            setLoading(false);
        }
    }, [filterType]);

    useEffect(() => {
        fetchResources();
    }, [fetchResources]);

    // Handle initial file from navigation state
    useEffect(() => {
        if (location.state?.fileData) {
            // Clear state  
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate]);

    // Handle file selection and upload
    const handleFileSelect = async (file) => {
        console.log('📁 File selected:', file.name, 'Type:', file.type, 'Size:', file.size);
        setUploading(true);
        try {
            // Upload file to backend
            console.log('⬆️  Uploading file to backend...');
            const result = await uploadResourceFile(file);
            
            console.log('✅ Upload response:', result);
            
            // Ensure modal stays visible
            setUploadModalVisible(true);
            
            // Auto-fill form with file info - use setTimeout to ensure form is rendered
            setTimeout(() => {
                form.setFieldsValue({
                    title: result.display_name,
                    resource_type: detectResourceType(result.display_name),
                    description: `Size: ${(result.file_size / 1024 / 1024).toFixed(2)} MB`
                });
            }, 100);
            
            setUploadedFile(result);
            message.success(`✓ File uploaded: ${result.display_name}`);
        } catch (error) {
            console.error('❌ File upload failed:', error);
            console.error('Error details:', error.response?.data || error.message);
            message.error(error.response?.data?.detail || 'File upload failed');
            setUploadedFile(null);
        } finally {
            setUploading(false);
        }
        return false; // Prevent automatic upload
    };

    // Handle upload
    const handleUpload = async (values) => {
        console.log('💾 Saving resource with values:', values);
        console.log('📄 Uploaded file:', uploadedFile);
        
        if (!uploadedFile) {
            message.error('Please upload a file first');
            console.warn('⚠️ No uploaded file found!');
            return;
        }
        
        setSubmitting(true);
        try {
            // Use the file_url from uploaded file
            const resourceData = {
                ...values,
                url: uploadedFile.file_url,
                team_id: values.team_id ? parseInt(values.team_id) : null
            };
            
            console.log('📮 Sending to backend:', resourceData);
            await createResource(resourceData);
            console.log('✅ Resource created successfully!');
            message.success('Resource created successfully!');
            setUploadModalVisible(false);
            form.resetFields();
            setUploadedFile(null);
            fetchResources();
        } catch (error) {
            console.error('❌ Failed to create resource:', error);
            
            // Handle Pydantic validation errors
            let errorMsg = 'Failed to create resource';
            if (error.response?.data?.detail) {
                const detail = error.response.data.detail;
                if (Array.isArray(detail)) {
                    // Pydantic validation errors
                    errorMsg = detail.map(e => {
                        if (typeof e === 'string') return e;
                        if (e.msg) return `${e.loc?.join('.')}: ${e.msg}`;
                        return JSON.stringify(e);
                    }).join('; ');
                } else if (typeof detail === 'string') {
                    errorMsg = detail;
                }
            }
            console.error('Error details:', errorMsg);
            message.error(errorMsg);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle delete
    const handleDelete = async (resourceId) => {
        try {
            await deleteResource(resourceId);
            message.success('Resource deleted successfully!');
            fetchResources();
        } catch (error) {
            console.error('Failed to delete resource:', error);
            message.error('Failed to delete resource');
        }
    };

    const openResource = (file) => {
        if (!file || !file.url) {
            message.warning('File URL is not available');
            return;
        }
        
        // Construct full URL for download
        const fileUrl = file.url.startsWith('/api') 
            ? `${window.location.origin}${file.url}`
            : file.url;
        
        // Create link and trigger download
        const link = document.createElement('a');
        link.href = fileUrl;
        link.target = '_blank';
        link.download = file.title || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Get file type config
    const getFileConfig = (type) => {
        return FILE_TYPE_CONFIG[type] || FILE_TYPE_CONFIG.other;
    };

    // Format date
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Unknown';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffHours < 1) return 'Just now';
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    // Calculate stats and sort by newest first
    const sortedResources = [...resources].sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA; // Newest first
    });

    const totalFiles = resources.length;
    const sharedFiles = resources.filter(r => r.team_id || r.project_id).length;

    // Separate recent files and uploaded files from sorted list (newest first)
    const recentFiles = sortedResources.slice(0, 6);
    const uploadedFiles = sortedResources.slice(0, 3);

    return (
        <div style={{ padding: 24, backgroundColor: '#f5f7fa', minHeight: '100vh' }}>
            {/* Header */}
            <Card
                style={{ marginBottom: 24, borderRadius: 12 }}
                bodyStyle={{ padding: '16px 24px' }}
            >
                <Row justify="space-between" align="middle">
                    <Col>
                        <Space>
                            <FolderOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                            <Title level={4} style={{ margin: 0 }}>Files & Documents</Title>
                        </Space>
                    </Col>
                    <Col>
                        <Space>
                            <Button onClick={() => setViewAllModalVisible(true)}>View All Files</Button>
                            <Button
                                type="primary"
                                icon={<UploadOutlined />}
                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                                onClick={() => {
                                    setUploadModalVisible(true);
                                    setUploadedFile(null);
                                    form.resetFields();
                                }}
                            >
                                Upload Files
                            </Button>
                        </Space>
                    </Col>
                </Row>
            </Card>

            {/* Stats Row */}
            <Row gutter={24} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                            title="Total Files"
                            value={totalFiles}
                            valueStyle={{ color: '#722ed1', fontSize: 36 }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                            title="Shared Files"
                            value={sharedFiles}
                            valueStyle={{ color: '#52c41a', fontSize: 36 }}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card style={{ borderRadius: 12, textAlign: 'center' }}>
                        <Statistic
                            title="File Types"
                            value={Object.keys(FILE_TYPE_CONFIG).length}
                            valueStyle={{ color: '#1890ff', fontSize: 36 }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Uploaded Files Section */}
            <Card
                title="Uploaded Files"
                style={{ marginBottom: 24, borderRadius: 12 }}
                extra={
                    <Space>
                        <Select
                            value={filterType}
                            onChange={setFilterType}
                            style={{ width: 150 }}
                        >
                            <Option value="all">All Types</Option>
                            {Object.entries(RESOURCE_TYPES).map(([key, value]) => (
                                <Option key={value} value={value}>
                                    {RESOURCE_TYPE_LABELS[value]?.label || key}
                                </Option>
                            ))}
                        </Select>
                        <Button icon={<ReloadOutlined />} onClick={fetchResources}>
                            Refresh
                        </Button>
                    </Space>
                }
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
                ) : uploadedFiles.length === 0 ? (
                    <Empty description="No files uploaded yet" />
                ) : (
                    uploadedFiles.map(file => {
                        const config = getFileConfig(file.resource_type);
                        return (
                            <Row
                                key={file.id}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid #f0f0f0',
                                    alignItems: 'center'
                                }}
                            >
                                <Col span={1}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 8,
                                        backgroundColor: config.bgColor,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: config.color, fontSize: 18
                                    }}>
                                        {config.icon}
                                    </div>
                                </Col>
                                <Col span={17} style={{ paddingLeft: 16 }}>
                                    <Text strong style={{ display: 'block' }}>{file.title}</Text>
                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                        {config.label} • {file.description || 'No description'}
                                    </Text>
                                </Col>
                                <Col span={3} style={{ textAlign: 'center' }}>
                                    <Text type="secondary">{formatDate(file.created_at)}</Text>
                                </Col>
                                <Col span={3} style={{ textAlign: 'right' }}>
                                    <Space>
                                        <Tooltip title="View">
                                            <Button
                                                type="link"
                                                icon={<EyeOutlined />}
                                                onClick={() => openResource(file)}
                                            />
                                        </Tooltip>
                                        <Popconfirm
                                            title="Delete this resource?"
                                            onConfirm={() => handleDelete(file.resource_id)}
                                            okText="Yes"
                                            cancelText="No"
                                        >
                                            <Button type="link" danger icon={<DeleteOutlined />}>
                                                Remove
                                            </Button>
                                        </Popconfirm>
                                    </Space>
                                </Col>
                            </Row>
                        );
                    })
                )}
            </Card>

            {/* Recent Files Grid */}
            <Card
                title="Recent Files"
                style={{ marginBottom: 24, borderRadius: 12 }}
            >
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>
                ) : recentFiles.length === 0 ? (
                    <Empty description="No recent files" />
                ) : (
                    <Row gutter={[16, 16]}>
                        {recentFiles.map(file => {
                            const config = getFileConfig(file.resource_type);
                            return (
                                <Col span={8} key={file.id}>
                                    <Card
                                        hoverable
                                        style={{ borderRadius: 12 }}
                                        onClick={() => openResource(file)}
                                    >
                                        <Row align="middle">
                                            <Col>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 10,
                                                    backgroundColor: config.bgColor,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: config.color, fontSize: 22
                                                }}>
                                                    {config.icon}
                                                </div>
                                            </Col>
                                            <Col style={{ paddingLeft: 12, flex: 1 }}>
                                                <Text strong style={{ display: 'block', fontSize: 14 }}>
                                                    {file.title}
                                                </Text>
                                                <Tag color={config.color} style={{ marginTop: 4 }}>
                                                    {config.label}
                                                </Tag>
                                            </Col>
                                        </Row>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                                            Updated {formatDate(file.created_at)}
                                        </Text>
                                    </Card>
                                </Col>
                            );
                        })}
                    </Row>
                )}
            </Card>

            {/* Quick Actions */}
            <Card style={{ borderRadius: 12 }}>
                <Text strong style={{ marginBottom: 12, display: 'block' }}>Quick Actions</Text>
                <Space>
                    <Button icon={<FilePdfOutlined />}>Export as PDF</Button>
                    <Button icon={<FolderOutlined />}>Create Folder</Button>
                    <Button icon={<FileTextOutlined />}>New Document</Button>
                </Space>
            </Card>

            {/* Upload Modal */}
            <Modal
                title="Upload Resource"
                open={uploadModalVisible}
                onCancel={() => {
                    setUploadModalVisible(false);
                    form.resetFields();
                    setUploadedFile(null);
                }}
                footer={null}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleUpload}
                >
                    {/* File Upload */}
                    <Form.Item
                        label="Select File"
                        required
                    >
                        <Upload
                            beforeUpload={handleFileSelect}
                            maxCount={1}
                            accept=".pdf,.doc,.docx,.json,.csv,.xls,.xlsx,.pptx,.png,.jpg,.jpeg,.gif,.zip,.rar"
                            disabled={uploading}
                        >
                            <Button icon={<UploadOutlined />} loading={uploading}>
                                {uploading ? 'Uploading...' : 'Choose File'}
                            </Button>
                        </Upload>
                        {uploadedFile && (
                            <div style={{ marginTop: 8 }}>
                                <Tag color="green">✓ {uploadedFile.display_name}</Tag>
                            </div>
                        )}
                    </Form.Item>

                    <Form.Item
                        name="title"
                        label="Title"
                        rules={[{ required: true, message: 'Please enter a title' }]}
                    >
                        <Input placeholder="Resource title (auto-filled)" />
                    </Form.Item>

                    <Form.Item
                        name="resource_type"
                        label="Resource Type"
                        rules={[{ required: true, message: 'Please select a type' }]}
                    >
                        <Select placeholder="Auto-detected based on file">
                            {Object.entries(RESOURCE_TYPES).map(([key, value]) => (
                                <Option key={value} value={value}>
                                    {getResourceTypeInfo(value).icon} {RESOURCE_TYPE_LABELS[value]?.label || key}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea rows={3} placeholder="Optional description (auto-filled with file size)" />
                    </Form.Item>

                    <Form.Item
                        name="team_id"
                        label="Team ID (Optional)"
                    >
                        <Input type="number" placeholder="Enter team ID to share with team" />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => {
                                setUploadModalVisible(false);
                                form.resetFields();
                                setUploadedFile(null);
                            }}>Cancel</Button>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                                disabled={!uploadedFile}
                                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                            >
                                Save Resource
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* View All Files Modal */}
            <Modal
                title={`All Resources (${resources.length} total)`}
                open={viewAllModalVisible}
                onCancel={() => setViewAllModalVisible(false)}
                width={900}
                footer={[
                    <Button key="close" onClick={() => setViewAllModalVisible(false)}>
                        Close
                    </Button>
                ]}
            >
                <Table
                    dataSource={sortedResources}
                    columns={[
                        {
                            title: 'Name',
                            dataIndex: 'title',
                            key: 'title',
                            width: '40%',
                            render: (text, record) => (
                                <Space>
                                    <span>{getFileConfig(record.resource_type).icon}</span>
                                    <span>{text}</span>
                                </Space>
                            )
                        },
                        {
                            title: 'Type',
                            dataIndex: 'resource_type',
                            key: 'resource_type',
                            width: '15%',
                            render: (type) => {
                                const config = getFileConfig(type);
                                return <Tag color={config.color}>{config.label}</Tag>;
                            }
                        },
                        {
                            title: 'Uploaded',
                            dataIndex: 'created_at',
                            key: 'created_at',
                            width: '20%',
                            render: (date) => formatDate(date)
                        },
                        {
                            title: 'Actions',
                            key: 'actions',
                            width: '15%',
                            align: 'center',
                            render: (_, record) => (
                                <Space>
                                    <Tooltip title="Download/View">
                                        <Button
                                            type="link"
                                            icon={<EyeOutlined />}
                                            onClick={() => openResource(record)}
                                        />
                                    </Tooltip>
                                    <Popconfirm
                                        title="Delete this resource?"
                                        onConfirm={() => {
                                            handleDelete(record.resource_id);
                                            setViewAllModalVisible(false);
                                        }}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        <Button type="link" danger icon={<DeleteOutlined />} />
                                    </Popconfirm>
                                </Space>
                            )
                        }
                    ]}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: true }}
                />
            </Modal>
        </div>
    );
};

export default ResourcesPage;
