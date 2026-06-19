import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  User,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  NextOrObserver,
  Unsubscribe
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  increment 
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';

// Detect if real credentials have been provided by the user
export const isFirebaseConfigured = !!(
  firebaseConfig &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('TU-NUEVO') &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('TU-NUEVO')
);

// Fallback generic config when unconfigured to prevent compile/startup crash
const genericConfig = {
  projectId: "aerowall-unconfigured",
  appId: "1:999999999999:web:999999999999abcdef",
  apiKey: "AI" + "zaSy" + "PlaceholderKey_999999999999abcdef",
  authDomain: "aerowall-unconfigured.firebaseapp.com",
  storageBucket: "aerowall-unconfigured.appspot.com",
  messagingSenderId: "999999999999"
};

const finalConfig = isFirebaseConfigured ? firebaseConfig : genericConfig;

// Initialize Firebase safely
let app: any;
let dbInstance: any;
let authInstance: any;

try {
  app = initializeApp(finalConfig);
  dbInstance = getFirestore(app);
  authInstance = getAuth(app);
} catch (e) {
  console.warn("Failsafe initialize on server or cold start:", e);
}

export const db = dbInstance;
export const auth = authInstance;
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Simulated Local Storage fallback helper for unconfigured mode
const isBrowser = typeof window !== 'undefined';
const mockUser = {
  uid: 'user_aerowall_sim',
  displayName: 'Andrés (Simulado)',
  email: 'andressy1126@gmail.com',
  photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120',
  emailVerified: true,
  isAnonymous: false,
} as unknown as User;

const simulatedAuthListeners: ((user: User | null) => void)[] = [];

function triggerSimulatedAuthChange(user: User | null) {
  if (isBrowser) {
    if (user) {
      localStorage.setItem('aerowall_mock_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('aerowall_mock_user');
    }
  }
  simulatedAuthListeners.forEach(listener => listener(user));
}

// Wrapper for Auth Observer
export function onAuthStateChanged(
  authObj: any,
  nextOrObserver: NextOrObserver<User>,
  error?: any,
  completed?: any
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const storedUser = isBrowser ? localStorage.getItem('aerowall_mock_user') : null;
    let currentUser: User | null = null;
    if (storedUser) {
      try {
        currentUser = JSON.parse(storedUser) as User;
      } catch {}
    }
    
    setTimeout(() => {
      if (typeof nextOrObserver === 'function') {
        nextOrObserver(currentUser);
      } else if (nextOrObserver && typeof nextOrObserver === 'object') {
        (nextOrObserver as any).next(currentUser);
      }
    }, 100);

    const listener = (user: User | null) => {
      if (typeof nextOrObserver === 'function') {
        nextOrObserver(user);
      } else if (nextOrObserver && typeof nextOrObserver === 'object') {
        (nextOrObserver as any).next(user);
      }
    };
    simulatedAuthListeners.push(listener);
    
    return () => {
      const idx = simulatedAuthListeners.indexOf(listener);
      if (idx !== -1) simulatedAuthListeners.splice(idx, 1);
    };
  } else {
    return firebaseOnAuthStateChanged(authObj, nextOrObserver, error, completed);
  }
}

// Authentication
export async function loginWithGoogle(): Promise<User> {
  if (!isFirebaseConfigured) {
    triggerSimulatedAuthChange(mockUser);
    return mockUser;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Authentication Error during Google login:', error);
    throw error;
  }
}

export async function logoutUser(): Promise<void> {
  if (!isFirebaseConfigured) {
    triggerSimulatedAuthChange(null);
    return;
  }
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// Firestore operations for Wallpapers
export interface WallpaperData {
  id?: string;
  title: string;
  url: string;
  orientation: 'vertical' | 'horizontal';
  uploadedBy: string;
  uploaderName?: string;
  uploaderEmail?: string;
  uploadedAt: string;
  approved: boolean;
  moderationPassed?: boolean;
  qualityScore?: number;
  aesthetic?: string;
  feedback?: string;
  downloadsCount: number;
  likesCount: number;
}

export async function fetchAllWallpapers(): Promise<WallpaperData[]> {
  if (!isFirebaseConfigured) {
    if (!isBrowser) return [];
    const stored = localStorage.getItem('aerowall_mock_wps');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return []; // Return empty initially so initializer effects seed high-quality content locally in memory!
  }

  const path = 'wallpapers';
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WallpaperData));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function uploadNewWallpaper(wallpaper: Omit<WallpaperData, 'downloadsCount' | 'likesCount'>): Promise<string> {
  const wallpaperId = 'wp_' + Math.random().toString(36).substring(2, 15);
  
  if (!isFirebaseConfigured) {
    const list = await fetchAllWallpapers();
    const fullData: WallpaperData = {
      ...wallpaper,
      id: wallpaperId,
      downloadsCount: 0,
      likesCount: 0
    };
    list.unshift(fullData);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_wps', JSON.stringify(list));
    }
    return wallpaperId;
  }

  const path = 'wallpapers';
  try {
    const docRef = doc(db, path, wallpaperId);
    const fullData = {
      ...wallpaper,
      downloadsCount: 0,
      likesCount: 0
    };
    await setDoc(docRef, fullData);
    return wallpaperId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${wallpaperId}`);
  }
}

export async function updateWallpaperStatus(wallpaperId: string, status: {
  approved: boolean;
  moderationPassed?: boolean;
  qualityScore?: number;
  aesthetic?: string;
  feedback?: string;
}): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchAllWallpapers();
    const updated = list.map(w => w.id === wallpaperId ? { ...w, ...status } : w);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_wps', JSON.stringify(updated));
    }
    return;
  }

  const path = `wallpapers/${wallpaperId}`;
  try {
    const docRef = doc(db, 'wallpapers', wallpaperId);
    await updateDoc(docRef, status);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface DownloadLogData {
  id: string;
  wallpaperId: string;
  wallpaperTitle: string;
  requestedBy: string;
  requestedByEmail: string;
  requestedByName: string;
  requestedAt: string;
}

export async function fetchDownloadLogs(): Promise<DownloadLogData[]> {
  if (!isFirebaseConfigured) {
    if (!isBrowser) return [];
    const stored = localStorage.getItem('aerowall_mock_download_logs');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return [];
  }
  const path = 'download_logs';
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DownloadLogData));
    return logs.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function triggerDownload(
  wallpaperId: string,
  wallpaperTitle: string,
  userId: string,
  userEmail: string,
  userName: string
): Promise<void> {
  const logId = 'req_' + Math.random().toString(36).substring(2, 15);
  const logEntry: DownloadLogData = {
    id: logId,
    wallpaperId,
    wallpaperTitle,
    requestedBy: userId,
    requestedByEmail: userEmail || 'anonymous@onyxwall.com',
    requestedByName: userName || 'Anónimo',
    requestedAt: new Date().toISOString()
  };

  if (!isFirebaseConfigured) {
    const list = await fetchAllWallpapers();
    const updated = list.map(w => w.id === wallpaperId ? { ...w, downloadsCount: w.downloadsCount + 1 } : w);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_wps', JSON.stringify(updated));
    }
    
    // Save locally
    let logs = await fetchDownloadLogs();
    logs.unshift(logEntry);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_download_logs', JSON.stringify(logs));
    }
    return;
  }

  const path = `wallpapers/${wallpaperId}`;
  try {
    const docRef = doc(db, 'wallpapers', wallpaperId);
    await updateDoc(docRef, {
      downloadsCount: increment(1)
    });

    const auditRef = doc(db, 'download_logs', logId);
    await setDoc(auditRef, logEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleLikeStatus(wallpaperId: string, diff: number): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchAllWallpapers();
    const updated = list.map(w => w.id === wallpaperId ? { ...w, likesCount: Math.max(0, w.likesCount + diff) } : w);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_wps', JSON.stringify(updated));
    }
    return;
  }

  const path = `wallpapers/${wallpaperId}`;
  try {
    const docRef = doc(db, 'wallpapers', wallpaperId);
    await updateDoc(docRef, {
      likesCount: increment(diff)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWallpaper(wallpaperId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchAllWallpapers();
    const filtered = list.filter(w => w.id !== wallpaperId);
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_wps', JSON.stringify(filtered));
    }
    return;
  }

  const path = `wallpapers/${wallpaperId}`;
  try {
    const docRef = doc(db, 'wallpapers', wallpaperId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// User Favorites management
export interface FavoriteData {
  wallpaperId: string;
  favoritedAt: string;
}

export async function fetchUserFavorites(userId: string): Promise<FavoriteData[]> {
  if (!isFirebaseConfigured) {
    if (!isBrowser) return [];
    const stored = localStorage.getItem(`aerowall_mock_favorites_${userId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return [];
  }

  const path = `users/${userId}/favorites`;
  try {
    const q = query(collection(db, 'users', userId, 'favorites'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data() } as FavoriteData));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addFavoriteWallpaper(userId: string, wallpaperId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchUserFavorites(userId);
    if (!list.some(f => f.wallpaperId === wallpaperId)) {
      list.push({ wallpaperId, favoritedAt: new Date().toISOString() });
      if (isBrowser) {
        localStorage.setItem(`aerowall_mock_favorites_${userId}`, JSON.stringify(list));
      }
    }
    return;
  }

  const path = `users/${userId}/favorites/${wallpaperId}`;
  try {
    const docRef = doc(db, 'users', userId, 'favorites', wallpaperId);
    await setDoc(docRef, {
      wallpaperId,
      favoritedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeFavoriteWallpaper(userId: string, wallpaperId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchUserFavorites(userId);
    const updated = list.filter(f => f.wallpaperId !== wallpaperId);
    if (isBrowser) {
      localStorage.setItem(`aerowall_mock_favorites_${userId}`, JSON.stringify(updated));
    }
    return;
  }

  const path = `users/${userId}/favorites/${wallpaperId}`;
  try {
    const docRef = doc(db, 'users', userId, 'favorites', wallpaperId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Persistent user notifications
export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  timestamp: string; // ISO String
  seen: boolean;
}

export async function fetchUserNotifications(userId: string): Promise<AppNotification[]> {
  if (!isFirebaseConfigured) {
    if (!isBrowser) return [];
    const stored = localStorage.getItem(`aerowall_mock_notifications_${userId}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return [];
  }

  const path = `users/${userId}/notifications`;
  try {
    const q = query(collection(db, 'users', userId, 'notifications'));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
    // Sort descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function addUserNotification(
  userId: string, 
  notif: Omit<AppNotification, 'id' | 'timestamp' | 'seen'>
): Promise<string> {
  const notifId = 'notif_' + Math.random().toString(36).substring(2, 11);
  const newNotif: AppNotification = {
    ...notif,
    id: notifId,
    timestamp: new Date().toISOString(),
    seen: false
  };

  if (!isFirebaseConfigured) {
    const list = await fetchUserNotifications(userId);
    list.unshift(newNotif);
    if (isBrowser) {
      localStorage.setItem(`aerowall_mock_notifications_${userId}`, JSON.stringify(list));
    }
    return notifId;
  }

  const path = `users/${userId}/notifications/${notifId}`;
  try {
    const docRef = doc(db, 'users', userId, 'notifications', notifId);
    await setDoc(docRef, newNotif);
    return notifId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markNotificationAsSeen(userId: string, notificationId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchUserNotifications(userId);
    const updated = list.map(n => n.id === notificationId ? { ...n, seen: true } : n);
    if (isBrowser) {
      localStorage.setItem(`aerowall_mock_notifications_${userId}`, JSON.stringify(updated));
    }
    return;
  }

  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'users', userId, 'notifications', notificationId);
    await updateDoc(docRef, { seen: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const list = await fetchUserNotifications(userId);
    const updated = list.filter(n => n.id !== notificationId);
    if (isBrowser) {
      localStorage.setItem(`aerowall_mock_notifications_${userId}`, JSON.stringify(updated));
    }
    return;
  }

  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    const docRef = doc(db, 'users', userId, 'notifications', notificationId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// User Profile management for robust admin audits and uploader identity correctness
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  lastLogin: string;
}

export async function syncUserProfile(user: User): Promise<UserProfile> {
  const defaultProfile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName || 'Usuario de OnyxWall',
    email: user.email || 'anonimo@onyxwall.com',
    photoURL: user.photoURL || 'https://picsum.photos/seed/user/100/100',
    lastLogin: new Date().toISOString()
  };

  if (!isFirebaseConfigured) {
    if (isBrowser) {
      localStorage.setItem('aerowall_mock_user_profile', JSON.stringify(defaultProfile));
    }
    return defaultProfile;
  }

  const path = `users/${user.uid}`;
  try {
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    let finalProfile: UserProfile;

    if (docSnap.exists()) {
      const data = docSnap.data();
      finalProfile = {
        uid: user.uid,
        displayName: data['displayName'] || defaultProfile.displayName,
        email: data['email'] || defaultProfile.email,
        photoURL: data['photoURL'] || defaultProfile.photoURL,
        lastLogin: new Date().toISOString()
      };
    } else {
      finalProfile = defaultProfile;
    }

    await setDoc(docRef, finalProfile, { merge: true });
    return finalProfile;
  } catch (error) {
    console.error('Error syncing user profile: ', error);
    // Silent fail so authentication doesn't block the user
    return defaultProfile;
  }
}

export async function fetchAllUsers(): Promise<UserProfile[]> {
  if (!isFirebaseConfigured) {
    return [
      {
        uid: 'user_aerowall_sim',
        displayName: 'Andrés (Simulado)',
        email: 'andressy1126@gmail.com',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&h=120',
        lastLogin: new Date().toISOString()
      },
      {
        uid: 'user_mock_sec',
        displayName: 'Usuario Secundario',
        email: 'secundaria@onyxwall.com',
        photoURL: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&h=120',
        lastLogin: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  }

  const path = 'users';
  try {
    const q = query(collection(db, path));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  } catch (error) {
    console.error('Error fetching registered users:', error);
    return [];
  }
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  if (!isFirebaseConfigured) {
    return;
  }
  try {
    const docRef = doc(db, 'users', userId);
    await setDoc(docRef, data, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
  }
}
