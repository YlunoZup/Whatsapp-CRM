import { useState } from 'react';
import {
  useWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useToggleWebhook,
  useTestWebhook,
} from '../hooks/use-webhooks';
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '../hooks/use-api-keys';
import type { WebhookEndpoint, WebhookEvent, ApiKey } from '@whatsapp-crm/shared';

const WEBHOOK_EVENTS: { value: WebhookEvent; label: string; description: string }[] = [
  { value: 'message.received', label: 'Message Received', description: 'When a new message is received' },
  { value: 'message.sent', label: 'Message Sent', description: 'When a message is sent' },
  { value: 'message.delivered', label: 'Message Delivered', description: 'When a message is delivered' },
  { value: 'message.read', label: 'Message Read', description: 'When a message is read' },
  { value: 'conversation.created', label: 'Conversation Created', description: 'When a new conversation starts' },
  { value: 'conversation.closed', label: 'Conversation Closed', description: 'When a conversation is closed' },
  { value: 'contact.created', label: 'Contact Created', description: 'When a new contact is created' },
  { value: 'contact.updated', label: 'Contact Updated', description: 'When a contact is updated' },
  { value: 'session.connected', label: 'Session Connected', description: 'When a WhatsApp session connects' },
  { value: 'session.disconnected', label: 'Session Disconnected', description: 'When a session disconnects' },
];

const API_PERMISSIONS = [
  { value: 'messages:read', label: 'Read Messages' },
  { value: 'messages:write', label: 'Send Messages' },
  { value: 'contacts:read', label: 'Read Contacts' },
  { value: 'contacts:write', label: 'Manage Contacts' },
  { value: 'conversations:read', label: 'Read Conversations' },
  { value: 'conversations:write', label: 'Manage Conversations' },
  { value: 'sessions:read', label: 'Read Sessions' },
  { value: 'sessions:write', label: 'Manage Sessions' },
];

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<'webhooks' | 'apikeys'>('webhooks');
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'webhook' | 'apikey'; id: string; name: string } | null>(null);

  // Webhooks
  const { data: webhooks, isLoading: webhooksLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();
  const toggleWebhook = useToggleWebhook();
  const testWebhook = useTestWebhook();

  // API Keys
  const { data: apiKeys, isLoading: apiKeysLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();

  // Webhook form state
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    events: [] as WebhookEvent[],
    secret: '',
  });

  // API Key form state
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    permissions: [] as string[],
  });

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookForm.name || !webhookForm.url || webhookForm.events.length === 0) return;

    try {
      await createWebhook.mutateAsync({
        name: webhookForm.name,
        url: webhookForm.url,
        events: webhookForm.events,
        secret: webhookForm.secret || undefined,
      });
      setShowWebhookModal(false);
      setWebhookForm({ name: '', url: '', events: [], secret: '' });
    } catch (error) {
      console.error('Failed to create webhook:', error);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyForm.name || apiKeyForm.permissions.length === 0) return;

    try {
      const result = await createApiKey.mutateAsync({
        name: apiKeyForm.name,
        permissions: apiKeyForm.permissions,
      });
      if (result.key) {
        setNewApiKey(result.key);
      }
      setShowApiKeyModal(false);
      setApiKeyForm({ name: '', permissions: [] });
    } catch (error) {
      console.error('Failed to create API key:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === 'webhook') {
        await deleteWebhook.mutateAsync(deleteConfirm.id);
      } else {
        await deleteApiKey.mutateAsync(deleteConfirm.id);
      }
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleToggleWebhook = async (webhook: WebhookEndpoint) => {
    try {
      await toggleWebhook.mutateAsync({ id: webhook.id, isActive: !webhook.isActive });
    } catch (error) {
      console.error('Failed to toggle webhook:', error);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await testWebhook.mutateAsync(webhookId);
      alert('Test webhook sent successfully!');
    } catch (error) {
      console.error('Failed to test webhook:', error);
      alert('Failed to send test webhook');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your CRM with external services via webhooks and API keys
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'webhooks'
              ? 'border-whatsapp-primary text-whatsapp-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Webhooks
          {webhooks && webhooks.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-muted rounded-full">{webhooks.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('apikeys')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'apikeys'
              ? 'border-whatsapp-primary text-whatsapp-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          API Keys
          {apiKeys && apiKeys.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-muted rounded-full">{apiKeys.length}</span>
          )}
        </button>
      </div>

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Webhook Endpoints</h2>
              <p className="text-sm text-muted-foreground">
                Receive real-time events to n8n, Zapier, Make.com, or your own services
              </p>
            </div>
            <button
              onClick={() => setShowWebhookModal(true)}
              className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Webhook
            </button>
          </div>

          {webhooksLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
                  <div className="h-5 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : webhooks && webhooks.length > 0 ? (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="bg-card rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-foreground">{webhook.name}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          webhook.isActive
                            ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {webhook.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 font-mono">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event) => (
                          <span key={event} className="px-2 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                            {event}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Last triggered: {formatDate(webhook.lastTriggeredAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestWebhook(webhook.id)}
                        className="p-2 text-muted-foreground hover:text-blue-600 transition-colors"
                        title="Send test event"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleToggleWebhook(webhook)}
                        className={`p-2 transition-colors ${
                          webhook.isActive
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-muted-foreground hover:text-green-600'
                        }`}
                        title={webhook.isActive ? 'Disable' : 'Enable'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ type: 'webhook', id: webhook.id, name: webhook.name })}
                        className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="font-medium text-foreground">No webhook endpoints</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Create a webhook to receive real-time events in n8n, Zapier, Make.com, or your custom services
              </p>
              <button
                onClick={() => setShowWebhookModal(true)}
                className="mt-4 px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
              >
                Create First Webhook
              </button>
            </div>
          )}

          {/* Available Events */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-foreground mb-3">Available Events</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {WEBHOOK_EVENTS.map((event) => (
                <div key={event.value} className="text-sm">
                  <code className="px-2 py-1 bg-card border rounded text-xs">{event.value}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {activeTab === 'apikeys' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
              <p className="text-sm text-muted-foreground">
                Authenticate API requests from external services
              </p>
            </div>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create API Key
            </button>
          </div>

          {apiKeysLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="bg-card rounded-lg border p-4 animate-pulse">
                  <div className="h-5 bg-muted rounded w-1/4 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="bg-card rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-foreground">{apiKey.name}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 font-mono">
                        ••••••••••••{apiKey.id.slice(-8)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {apiKey.permissions.map((perm) => (
                          <span key={perm} className="px-2 py-0.5 text-xs bg-purple-50 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded">
                            {perm}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Last used: {formatDate(apiKey.lastUsedAt)} | Created: {formatDate(apiKey.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'apikey', id: apiKey.id, name: apiKey.name })}
                      className="p-2 text-muted-foreground hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-card rounded-lg border p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="font-medium text-foreground">No API keys</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Create an API key to integrate with n8n, Make.com, GoHighLevel, or your custom applications
              </p>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="mt-4 px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
              >
                Create First API Key
              </button>
            </div>
          )}

          {/* Usage Example */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium text-foreground mb-3">API Usage Example</h3>
            <pre className="text-sm bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`# Send a message via API
curl -X POST https://your-domain.com/api/v1/messages/send \\
  -H "X-API-Key: your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sessionId": "session-id",
    "to": "+5511999999999",
    "type": "text",
    "content": "Hello from the API!"
  }'`}
            </pre>
          </div>
        </div>
      )}

      {/* Create Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowWebhookModal(false)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">Create Webhook Endpoint</h3>
            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={webhookForm.name}
                  onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })}
                  placeholder="e.g., n8n Integration"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={webhookForm.url}
                  onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                  placeholder="https://your-service.com/webhook"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Secret (optional)
                </label>
                <input
                  type="text"
                  value={webhookForm.secret}
                  onChange={(e) => setWebhookForm({ ...webhookForm, secret: e.target.value })}
                  placeholder="For signature verification"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to sign webhook payloads for verification
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Events</label>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(event.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWebhookForm({
                              ...webhookForm,
                              events: [...webhookForm.events, event.value],
                            });
                          } else {
                            setWebhookForm({
                              ...webhookForm,
                              events: webhookForm.events.filter((ev) => ev !== event.value),
                            });
                          }
                        }}
                        className="mt-1 rounded border-border text-whatsapp-primary focus:ring-whatsapp-primary"
                      />
                      <div>
                        <p className="text-sm font-medium text-foreground">{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createWebhook.isPending || !webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {createWebhook.isPending ? 'Creating...' : 'Create Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowApiKeyModal(false)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Create API Key</h3>
            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={apiKeyForm.name}
                  onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                  placeholder="e.g., n8n Automation"
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Permissions</label>
                <div className="space-y-2 border rounded-lg p-3">
                  {API_PERMISSIONS.map((perm) => (
                    <label key={perm.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={apiKeyForm.permissions.includes(perm.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setApiKeyForm({
                              ...apiKeyForm,
                              permissions: [...apiKeyForm.permissions, perm.value],
                            });
                          } else {
                            setApiKeyForm({
                              ...apiKeyForm,
                              permissions: apiKeyForm.permissions.filter((p) => p !== perm.value),
                            });
                          }
                        }}
                        className="rounded border-border text-whatsapp-primary focus:ring-whatsapp-primary"
                      />
                      <span className="text-sm text-foreground">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 text-sm text-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createApiKey.isPending || !apiKeyForm.name || apiKeyForm.permissions.length === 0}
                  className="px-4 py-2 text-sm bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark disabled:opacity-50 transition-colors"
                >
                  {createApiKey.isPending ? 'Creating...' : 'Create API Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New API Key Display Modal */}
      {newApiKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
            <div className="text-center mb-4">
              <div className="w-12 h-12 mx-auto mb-4 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">API Key Created</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Copy your API key now. You won't be able to see it again.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono break-all">{newApiKey}</code>
                <button
                  onClick={() => copyToClipboard(newApiKey)}
                  className="p-2 text-muted-foreground hover:text-muted-foreground transition-colors"
                  title="Copy"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <button
              onClick={() => setNewApiKey(null)}
              className="w-full px-4 py-2 bg-whatsapp-primary text-white rounded-lg hover:bg-whatsapp-dark transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-card rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete {deleteConfirm.type === 'webhook' ? 'Webhook' : 'API Key'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteWebhook.isPending || deleteApiKey.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {(deleteWebhook.isPending || deleteApiKey.isPending) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
