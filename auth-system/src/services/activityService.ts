const API_BASE = 'http://localhost:3001/api';

export interface Activity {
  id: string;
  userId: string;
  type: 'upload' | 'search' | 'chat' | 'delete' | 'profile' | 'login' | 'logout';
  description: string;
  metadata?: Record<string, any>;
  timestamp: string;
  createdAt: string;
}

export interface ActivityStats {
  totalActivities: number;
  uploads: number;
  searches: number;
  chats: number;
  profileUpdates: number;
  recentTrend: any[];
}

export interface ActivityResponse {
  activities: Activity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

class ActivityService {
  private getAuthToken(): string | null {
    const session = localStorage.getItem('authSession');
    if (session) {
      const parsedSession = JSON.parse(session);
      return parsedSession.accessToken;
    }
    return null;
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getAuthToken();
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  }

  async getUserActivities(limit: number = 10, offset: number = 0, days: number = 7): Promise<ActivityResponse> {
    const response = await fetch(`${API_BASE}/activity?limit=${limit}&offset=${offset}&days=${days}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch activities');
    }

    return data.data;
  }

  async getActivityStats(days: number = 30): Promise<ActivityStats> {
    const response = await fetch(`${API_BASE}/activity/stats?days=${days}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch activity statistics');
    }

    return data.data.stats;
  }

  async createActivity(type: string, description: string, metadata?: Record<string, any>): Promise<Activity> {
    const response = await fetch(`${API_BASE}/activity`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        type,
        description,
        metadata
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create activity');
    }

    return data.data.activity;
  }

  async cleanupOldActivities(daysToKeep: number = 90): Promise<{ deletedCount: number }> {
    const response = await fetch(`${API_BASE}/activity/cleanup`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        daysToKeep
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to cleanup activities');
    }

    return data.data;
  }

  formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return time.toLocaleDateString();
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'upload': return '📤';
      case 'search': return '🔍';
      case 'chat': return '💬';
      case 'delete': return '🗑️';
      case 'profile': return '👤';
      case 'login': return '🔐';
      case 'logout': return '🚪';
      default: return '📋';
    }
  }

  getActivityColor(type: string): string {
    switch (type) {
      case 'upload': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'search': return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
      case 'chat': return 'linear-gradient(135deg, #8b5cf6, #7c3aed)';
      case 'delete': return 'linear-gradient(135deg, #ef4444, #dc2626)';
      case 'profile': return 'linear-gradient(135deg, #f59e0b, #d97706)';
      case 'login': return 'linear-gradient(135deg, #10b981, #059669)';
      case 'logout': return 'linear-gradient(135deg, #6b7280, #4b5563)';
      default: return 'linear-gradient(135deg, #6b7280, #4b5563)';
    }
  }
}

export const activityService = new ActivityService();