import { auth, logAuthDebug } from '../lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';

// Add the scopes authorized in the OAuth screen
export const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify'
];

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Google OAuth provider with scopes
const getGoogleProvider = () => {
  const provider = new GoogleAuthProvider();
  GMAIL_SCOPES.forEach(scope => provider.addScope(scope));
  // Request incremental authorization if needed
  provider.setCustomParameters({
    prompt: 'consent'
  });
  return provider;
};

// Listen to auth state to clear token if user logs out
export const initGmailAuth = (
  onSuccess?: (user: User, token: string) => void,
  onFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      if (cachedAccessToken) {
        if (onSuccess) onSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onFailure) onFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onFailure) onFailure();
    }
  });
};

// Sign in via Google popup to get Gmail access token
export const signInGmail = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve access token from Google Auth.');
    }
    
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: any) {
    logAuthDebug('gmailService.ts -> signInGmail', 'Google Sign-In (Gmail Companion)', err);
    console.error('[GmailAuth] Sign in failed:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

// Get current token in-memory
export const getGmailToken = (): string | null => {
  return cachedAccessToken;
};

// Disconnect/Logout Gmail (signs out of Firebase, which triggers clean up)
export const disconnectGmail = async () => {
  cachedAccessToken = null;
};

// Gmail REST API Interface Definitions
export interface GmailMessageItem {
  id: string;
  threadId: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
}

export interface DetailedGmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string; // decoded HTML/text body
  labels: string[];
}

// List Gmail messages
export const listGmailMessages = async (query?: string, maxResults = 10): Promise<DetailedGmailMessage[]> => {
  const token = getGmailToken();
  if (!token) throw new Error('Gmail token missing. Please sign in.');

  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to list Gmail messages');
  }

  const data = await response.json();
  const messageItems: GmailMessageItem[] = data.messages || [];
  
  // Fetch details of each message in parallel
  const detailPromises = messageItems.map(item => getGmailMessageDetails(item.id));
  return Promise.all(detailPromises);
};

// Get single Gmail message details and parse headers + body
export const getGmailMessageDetails = async (id: string): Promise<DetailedGmailMessage> => {
  const token = getGmailToken();
  if (!token) throw new Error('Gmail token missing. Please sign in.');

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch message details for ID: ${id}`);
  }

  const data = await response.json();
  
  // Parse headers
  const headers: Record<string, string> = {};
  if (data.payload?.headers) {
    data.payload.headers.forEach((h: any) => {
      headers[h.name.toLowerCase()] = h.value;
    });
  }

  // Parse body (supports text/html and text/plain multiparts)
  let body = '';
  const parsePart = (part: any) => {
    if (part.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === 'text/html') {
        body = decoded; // HTML takes priority
      } else if (part.mimeType === 'text/plain' && !body) {
        body = decoded;
      }
    }
    if (part.parts) {
      part.parts.forEach((p: any) => parsePart(p));
    }
  };

  if (data.payload) {
    parsePart(data.payload);
  }

  // Fallback to snippet if body is empty
  if (!body) {
    body = data.snippet || '';
  }

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet || '',
    subject: headers['subject'] || '(No Subject)',
    from: headers['from'] || 'Unknown Sender',
    to: headers['to'] || 'Unknown Recipient',
    date: headers['date'] || '',
    body,
    labels: data.labelIds || []
  };
};

// Send an email message via Gmail API
export const sendGmailMessage = async (to: string, subject: string, bodyContent: string): Promise<any> => {
  const token = getGmailToken();
  if (!token) throw new Error('Gmail token missing. Please sign in.');

  const rawMime = buildMimeString(to, subject, bodyContent);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawMime })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to send email via Gmail API');
  }

  return response.json();
};

// Create a Draft in Gmail
export const createGmailDraft = async (to: string, subject: string, bodyContent: string): Promise<any> => {
  const token = getGmailToken();
  if (!token) throw new Error('Gmail token missing. Please sign in.');

  const rawMime = buildMimeString(to, subject, bodyContent);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        raw: rawMime
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to create Gmail draft');
  }

  return response.json();
};

// Helper to base64url decode UTF-8 text safely
const decodeBase64Url = (base64url: string): string => {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  try {
    return decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch (e) {
    return atob(base64);
  }
};

// Helper to construct and encode MIME message structure for Gmail API
const buildMimeString = (to: string, subject: string, bodyHtml: string): string => {
  const mimeParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    bodyHtml
  ];
  
  const rawString = mimeParts.join('\r\n');
  return btoa(unescape(encodeURIComponent(rawString)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};
