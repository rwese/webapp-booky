// Sync Status Dashboard Component
import { useSyncStatus, useBackgroundSync, useConflictResolution, useSyncProgress } from '../../hooks/useSyncEnhanced';
import { RefreshCw, Cloud, CloudOff, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { useState } from 'react';

interface SyncStatusDashboardProps {
  onOpenSettings?: () => void;
  compact?: boolean;
}

export function SyncStatusDashboard({ onOpenSettings, compact = false }: SyncStatusDashboardProps) {
  const { 
    isOnline, 
    isSyncing, 
    lastSyncTime, 
    pendingOperations, 
    syncError, 
    backendStatus,
    syncNow, 
    fullSync 
  } = useSyncStatus();
  
  const { isSyncing: isBackgroundSyncing, syncError: bgSyncError } = useBackgroundSync();
  const { conflicts, resolveConflict, isResolving } = useConflictResolution();
  const { progress, percentage, isInProgress } = useSyncProgress();
  const [showDetails, setShowDetails] = useState(false);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getStatusIcon = () => {
    if (!isOnline) return <CloudOff className="w-5 h-5 text-red-500" />;
    if (syncError || bgSyncError) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    if (isSyncing || isBackgroundSyncing) return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
    if (backendStatus === 'connected') return <Cloud className="w-5 h-5 text-green-500" />;
    return <Cloud className="w-5 h-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (syncError || bgSyncError) return 'Sync Error';
    if (isSyncing || isBackgroundSyncing) return 'Syncing...';
    if (backendStatus === 'connected') return 'Connected';
    return 'Disconnected';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {getStatusIcon()}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {pendingOperations > 0 ? `${pendingOperations} pending` : 'Synced'}
        </span>
        {pendingOperations > 0 && !isSyncing && (
          <button
            type="button"
            onClick={() => syncNow()}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Sync now"
          >
            <RefreshCw className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Sync Status</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last synced: {formatTime(lastSyncTime)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className={`font-medium ${
              !isOnline ? 'text-red-600' : 
              syncError || bgSyncError ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isInProgress && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-blue-700 dark:text-blue-300 capitalize">{progress.phase}</span>
            <span className="text-blue-600 dark:text-blue-400">{percentage}%</span>
          </div>
          <div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          {progress.message && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{progress.message}</p>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="p-4 space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            icon={<Cloud className="w-4 h-4" />}
            label="Network"
            value={isOnline ? 'Online' : 'Offline'}
            status={isOnline ? 'success' : 'error'}
          />
          <StatusCard
            icon={<RefreshCw className="w-4 h-4" />}
            label="Backend"
            value={backendStatus === 'connected' ? 'Connected' : backendStatus === 'disconnected' ? 'Disconnected' : 'Unknown'}
            status={backendStatus === 'connected' ? 'success' : backendStatus === 'disconnected' ? 'warning' : 'neutral'}
          />
          <StatusCard
            icon={<RefreshCw className="w-4 h-4" />}
            label="Pending"
            value={pendingOperations.toString()}
            status={pendingOperations > 0 ? 'warning' : 'success'}
          />
          <StatusCard
            icon={<CheckCircle className="w-4 h-4" />}
            label="Conflicts"
            value={conflicts.length.toString()}
            status={conflicts.length > 0 ? 'error' : 'success'}
          />
        </div>

        {/* Error Display */}
        {(syncError || bgSyncError) && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-700 dark:text-red-300">Sync Error</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {syncError || bgSyncError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  {conflicts.length} Conflict{conflicts.length > 1 ? 's' : ''} Detected
                </span>
              </div>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {conflicts.map((conflict) => (
                <div key={conflict.id} className="text-xs p-2 bg-yellow-100 dark:bg-yellow-900/40 rounded">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    {conflict.entity}: {conflict.entityId}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflict.id, 'keep_local')}
                      disabled={isResolving}
                      className="px-2 py-1 text-xs bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded"
                    >
                      Keep Local
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveConflict(conflict.id, 'keep_server')}
                      disabled={isResolving}
                      className="px-2 py-1 text-xs bg-yellow-200 dark:bg-yellow-800 hover:bg-yellow-300 dark:hover:bg-yellow-700 rounded"
                    >
                      Keep Server
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => syncNow()}
            disabled={!isOnline || isSyncing}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              !isOnline 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                : isSyncing 
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </>
            )}
          </button>
          
          <button
            type="button"
            onClick={() => fullSync()}
            disabled={!isOnline || isSyncing}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Full Sync
          </button>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Details Toggle */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>

        {/* Detailed Info */}
        {showDetails && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Last Sync</span>
              <span className="text-gray-900 dark:text-white">{formatTime(lastSyncTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Pending Operations</span>
              <span className="text-gray-900 dark:text-white">{pendingOperations}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Backend Status</span>
              <span className="text-gray-900 dark:text-white capitalize">{backendStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Conflicts</span>
              <span className="text-gray-900 dark:text-white">{conflicts.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Status Card Component
interface StatusCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: 'success' | 'error' | 'warning' | 'neutral';
}

function StatusCard({ icon, label, value, status }: StatusCardProps) {
  const statusColors = {
    success: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20',
    error: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20',
    warning: 'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-900/20',
    neutral: 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-800'
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${statusColors[status]}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// Compact Sync Indicator for Headers
export function SyncIndicator() {
  const { isOnline, isSyncing, pendingOperations } = useSyncStatus();
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-red-500" title="Offline">
        <CloudOff className="w-4 h-4" />
        <span className="text-xs">Offline</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1 text-blue-500" title="Syncing...">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-xs">Syncing</span>
      </div>
    );
  }

  if (pendingOperations > 0) {
    return (
      <div className="flex items-center gap-1 text-yellow-500" title={`${pendingOperations} pending`}>
        <Cloud className="w-4 h-4" />
        <span className="text-xs">{pendingOperations}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-green-500" title="Synced">
      <CheckCircle className="w-4 h-4" />
    </div>
  );
}
