import { openDB } from 'idb';

const DB_NAME = 'YallaMateDB';
const DB_VERSION = 5; // Incremented version to support all object stores correctly

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('outings')) {
        db.createObjectStore('outings', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('reels')) {
        db.createObjectStore('reels', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending_friend_requests')) {
        db.createObjectStore('pending_friend_requests', { keyPath: 'id' });
      }
    },
  });
};

export const saveOutingsToCache = async (outings: any[]) => {
  const db = await initDB();
  const tx = db.transaction('outings', 'readwrite');
  outings.forEach(outing => tx.store.put(outing));
  await tx.done;
};

export const getCachedOutings = async () => {
  const db = await initDB();
  return db.getAll('outings');
};

export const saveReelsToCache = async (reels: any[]) => {
  const db = await initDB();
  const tx = db.transaction('reels', 'readwrite');
  reels.forEach(reel => tx.store.put(reel));
  await tx.done;
};

export const getCachedReels = async () => {
  const db = await initDB();
  return db.getAll('reels');
};

export const saveMessageToPending = async (message: any) => {
  const db = await initDB();
  return db.put('pending_messages', message);
};

export const getPendingMessages = async () => {
  const db = await initDB();
  return db.getAll('pending_messages');
};

export const clearPendingMessages = async (keys: any[]) => {
  const db = await initDB();
  const tx = db.transaction('pending_messages', 'readwrite');
  keys.forEach(key => tx.store.delete(key));
  await tx.done;
};

export const saveFriendRequestToPending = async (op: any) => {
  const db = await initDB();
  return db.put('pending_friend_requests', op);
};

export const getPendingFriendRequests = async () => {
  const db = await initDB();
  return db.getAll('pending_friend_requests');
};

export const clearPendingFriendRequests = async (ids: string[]) => {
  const db = await initDB();
  const tx = db.transaction('pending_friend_requests', 'readwrite');
  ids.forEach(id => tx.store.delete(id));
  await tx.done;
};

export const saveMessagesToCache = async (messages: any[]) => {
  const db = await initDB();
  const tx = db.transaction('messages', 'readwrite');
  messages.forEach(message => tx.store.put(message));
  await tx.done;
};

export const getCachedMessages = async (outingId: string) => {
  const db = await initDB();
  const allMessages = await db.getAll('messages');
  return allMessages.filter(msg => msg.outingId === outingId);
};
