import { config } from "./config";
import Cookies from "js-cookie";

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.apiUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    const token = Cookies.get("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "GET",
      headers: this.getHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.refreshToken();
        return this.get(endpoint);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      credentials: "include",
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401) {
        await this.refreshToken();
        return this.post(endpoint, data);
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async patch<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      credentials: "include",
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async uploadFile(endpoint: string, formData: FormData): Promise<unknown> {
    const headers: HeadersInit = {};
    const token = Cookies.get("accessToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers,
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload Error: ${response.status}`);
    }

    return response.json();
  }

  private async refreshToken(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        Cookies.set("accessToken", data.accessToken, { expires: 1 / 96 }); // 15 minutes
      } else {
        // Refresh failed, redirect to login
        Cookies.remove("accessToken");
        window.location.href = "/login";
      }
    } catch {
      Cookies.remove("accessToken");
      window.location.href = "/login";
    }
  }
}

export const api = new ApiClient();

// Auth API
export const authApi = {
  getMe: () => api.get<User>("/auth/me"),
  logout: () => api.post("/auth/logout"),
};

// Users API
export const usersApi = {
  search: (query: string) =>
    api.get<{ users: User[] }>(`/users/search?q=${encodeURIComponent(query)}`),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  getContacts: () => api.get<{ contacts: User[] }>("/users/contacts"),
  updateProfile: (data: Partial<User>) => api.patch<User>("/users/me", data),
};

// Conversations API
export const conversationsApi = {
  getAll: () =>
    api.get<{ conversations: Conversation[]; total: number }>("/conversations"),
  getById: (id: string) => api.get<Conversation>(`/conversations/${id}`),
  create: (participantId: string) =>
    api.post<Conversation>("/conversations", { participantId }),
  markAsRead: (id: string) => api.post(`/conversations/${id}/read`),
};

// Messages API
export const messagesApi = {
  getByConversation: (conversationId: string, before?: string) =>
    api.get<{ messages: Message[]; hasMore: boolean }>(
      `/conversations/${conversationId}/messages${before ? `?before=${before}` : ""}`
    ),
  send: (
    conversationId: string,
    data: {
      encryptedContent: string;
      contentType: string;
      sessionVersion: number;
      ratchetStep: number;
    }
  ) => api.post<Message>(`/conversations/${conversationId}/messages`, data),
  markAsRead: (conversationId: string, messageId: string) =>
    api.post(`/conversations/${conversationId}/messages/${messageId}/read`),
  delete: (conversationId: string, messageId: string) =>
    api.delete(`/conversations/${conversationId}/messages/${messageId}`),
};

// Keys API
export const keysApi = {
  upload: (keys: {
    identityPublicKey: string;
    signedPreKey: string;
    signedPreKeySignature: string;
    oneTimePreKeys: Array<{ keyId: number; publicKey: string }>;
  }) => api.post("/keys/upload", keys),
  getUserKeys: (userId: string) =>
    api.get<{
      identityPublicKey: string;
      signedPreKey: string;
      signedPreKeySignature: string;
      oneTimePreKey: string | null;
    }>(`/keys/users/${userId}`),
  uploadOneTimeKeys: (keys: Array<{ keyId: number; publicKey: string }>) =>
    api.post("/keys/one-time-keys", { keys }),
  getOneTimeKeyCount: () =>
    api.get<{ count: number }>("/keys/one-time-keys/count"),
};

// Calls API
export const callsApi = {
  getIceServers: () =>
    api.get<{ iceServers: RTCIceServer[] }>("/calls/ice-servers"),
  getHistory: (conversationId: string) =>
    api.get<{ calls: Call[] }>(`/calls/history/${conversationId}`),
};

// Attachments API
export const attachmentsApi = {
  upload: (conversationId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("conversationId", conversationId);
    return api.uploadFile("/attachments/upload", formData);
  },
  getDownloadUrl: (attachmentId: string) =>
    api.get<{ downloadUrl: string }>(`/attachments/${attachmentId}`),
};

// Types
export interface User {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  is_online?: boolean;
  last_seen_at?: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name?: string;
  avatar_url?: string;
  participants: Array<{
    user_id: string;
    last_read_at: string;
    user: User;
  }>;
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  encrypted_content: string;
  content_type: "text" | "image" | "video" | "file" | "audio";
  session_version: number;
  ratchet_step: number;
  sender?: User;
  attachments?: Attachment[];
  reply_to_message_id?: string;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  // Decrypted content (client-side only)
  content?: string;
}

export interface Attachment {
  id: string;
  r2_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  thumbnail_r2_key?: string;
}

export interface Call {
  id: string;
  conversation_id: string;
  caller_id: string;
  type: "audio" | "video";
  status: string;
  duration?: number;
  initiated_at: string;
  answered_at?: string;
  ended_at?: string;
  caller?: User;
}


