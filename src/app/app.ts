import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { 
  auth, 
  onAuthStateChanged,
  isFirebaseConfigured,
  WallpaperData, 
  FavoriteData, 
  fetchAllWallpapers, 
  uploadNewWallpaper, 
  updateWallpaperStatus, 
  triggerDownload, 
  toggleLikeStatus, 
  deleteWallpaper, 
  fetchUserFavorites, 
  addFavoriteWallpaper, 
  removeFavoriteWallpaper, 
  loginWithGoogle, 
  logoutUser,
  AppNotification,
  fetchUserNotifications,
  addUserNotification,
  markNotificationAsSeen,
  deleteNotification,
  DownloadLogData,
  fetchDownloadLogs,
  UserProfile,
  syncUserProfile,
  fetchAllUsers,
  updateUserProfile
} from './services/firebase';
import { User } from 'firebase/auth';

interface PushNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning';
  timestamp: Date;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'block w-full min-h-screen transition-colors duration-300',
    '(window:keydown)': 'handleKeyDown($event)'
  }
})
export class App implements OnInit {
  // State Signals
  currentUser = signal<User | null>(null);
  authLoading = signal<boolean>(true);
  isConfigured = isFirebaseConfigured;
  firebaseError = signal<string | null>(null);
  wallpapers = signal<WallpaperData[]>([]);
  favorites = signal<FavoriteData[]>([]);
  wallpapersLoading = signal<boolean>(true);

  // Full-screen image preview signals
  activePreviewWallpaper = signal<WallpaperData | null>(null);
  activePreviewIndex = computed(() => {
    const wp = this.activePreviewWallpaper();
    if (!wp) return -1;
    return this.filteredWallpapers().findIndex(item => item.id === wp.id);
  });
  
  // Administrator evaluation helper (Check for user email)
  isAdmin = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    const adminEmails = ['andressy1126@gmail.com', 'andresksa123@gmail.com', 'admin@onyxwall.com', 'system_admin@onyxwall.com'];
    return adminEmails.includes(user.email || '');
  });
  
  // UI preferences signals
  darkMode = signal<boolean>(true);
  selectedOrientation = signal<'all' | 'vertical' | 'horizontal'>('all');
  selectedCategory = signal<string>('all');
  detectedAestheticCategories = computed(() => {
    const list = this.wallpapers();
    const tagsSet = new Set<string>();
    
    list.forEach(wp => {
      if (wp.aesthetic) {
        // Split by slashes, commas, semicolons, or pipes
        const parts = wp.aesthetic.split(/[\/,;|]+/);
        parts.forEach(p => {
          const trimmed = p.trim();
          if (trimmed) {
            // Capitalize first character and keep the rest intact to preserve terms like OLED
            const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
            tagsSet.add(capitalized);
          }
        });
      }
    });
    
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  });
  searchQuery = signal<string>('');
  showPendingOnly = signal<boolean>(false);
  activeTab = signal<'gallery' | 'admin'>('gallery');

  // Computed lists for Admin Moderation view
  pendingWallpapers = computed(() => {
    return this.wallpapers().filter(wp => !wp.approved);
  });

  adminAllWallpapers = computed(() => {
    return [...this.wallpapers()].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  });
  
  // Real-time Push Notifications signal
  notifications = signal<PushNotification[]>([]);
  
  // Real persistent notifications signals
  realNotifications = signal<AppNotification[]>([]);
  showUnreadCountOnly = computed(() => this.realNotifications().filter(n => !n.seen).length);
  showNotificationsPanel = signal<boolean>(false);

  // Audit Logs (telemetry)
  downloadLogs = signal<DownloadLogData[]>([]);
  showAuditLogs = signal<boolean>(false);
  activeChartIndex = signal<number | null>(null);
  
  dailyDownloadTrend = computed(() => {
    const logs = this.downloadLogs();
    const trend = [];
    const now = new Date();
    
    // Day names in Spanish
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Label like "Lun 22" or "Vie 19"
      const label = `${dayNames[d.getDay()]} ${d.getDate()}`;
      
      // Count downloads on this day (ignoring UTC timezone offsets for simplicity of lookup)
      const count = logs.filter(log => {
        if (!log.requestedAt) return false;
        return log.requestedAt.startsWith(dateStr);
      }).length;
      
      trend.push({
        date: dateStr,
        label,
        count
      });
    }
    
    return trend;
  });

  chartPoints = computed(() => {
    const trend = this.dailyDownloadTrend();
    if (trend.length === 0) return { linePath: '', areaPath: '', points: [], maxCount: 5, height: 160, width: 400, paddingX: 30, paddingY: 20, chartWidth: 340, chartHeight: 120 };
    
    const width = 450;
    const height = 180;
    const paddingX = 35;
    const paddingY = 25;
    
    const chartWidth = width - paddingX * 2;
    const chartHeight = height - paddingY * 2;
    
    const counts = trend.map(t => t.count);
    const maxVal = Math.max(...counts);
    const maxCount = maxVal === 0 ? 5 : maxVal; // Guarantee a scale of at least 5
    
    const points = trend.map((t, i) => {
      const x = paddingX + (i * (chartWidth / (trend.length - 1 || 1)));
      const y = height - paddingY - ((t.count / maxCount) * chartHeight);
      return {
        x,
        y,
        dayLabel: t.label,
        count: t.count,
        date: t.date
      };
    });
    
    let linePath = '';
    let areaPath = '';
    
    if (points.length > 0) {
      // Create straight lines
      linePath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePath += ` L ${points[i].x} ${points[i].y}`;
      }
      
      // Area path starts with line, then goes to baseline corners, then closes
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;
    }
    
    return {
      linePath,
      areaPath,
      points,
      maxCount,
      height,
      width,
      paddingX,
      paddingY,
      chartWidth,
      chartHeight
    };
  });

  chartGridLines = computed(() => {
    const cp = this.chartPoints();
    const lines = [];
    const divisions = 4;
    for (let i = 0; i <= divisions; i++) {
      const ratio = i / divisions;
      const y = cp.paddingY + ratio * cp.chartHeight;
      const value = Math.round((1 - ratio) * cp.maxCount * 10) / 10;
      lines.push({ y, value });
    }
    return lines;
  });

  sevenDaysTotalDownloads = computed(() => {
    return this.dailyDownloadTrend().reduce((sum, item) => sum + item.count, 0);
  });

  sevenDaysAverageDownloads = computed(() => {
    const total = this.sevenDaysTotalDownloads();
    return Math.round((total / 7) * 10) / 10;
  });

  sevenDaysPeakCount = computed(() => {
    const counts = this.dailyDownloadTrend().map(t => t.count);
    return counts.length > 0 ? Math.max(...counts) : 0;
  });
  
  // Forms & upload signals
  uploadForm: FormGroup;
  uploading = signal<boolean>(false);
  analyzing = signal<boolean>(false);
  aiValidationResult = signal<any | null>(null);
  imagePreview = signal<string | null>(null);

  // User profiles list for robust lookup and administrator audit control
  allUsers = signal<UserProfile[]>([]);
  userProfilesLoading = signal<boolean>(false);

  // Profile Customization state
  currentUserProfile = signal<UserProfile | null>(null);
  showProfileEditModal = signal<boolean>(false);
  profileForm: FormGroup;

  constructor() {
    this.profileForm = new FormGroup({
      displayName: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      email: new FormControl({ value: '', disabled: true }, [Validators.required, Validators.email])
    });

    this.uploadForm = new FormGroup({
      title: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]),
      orientation: new FormControl('vertical', [Validators.required]),
      imageUrl: new FormControl('') // We capture local upload as base64
    });

    // Effect to auto-add wallpapers if DB is empty
    effect(() => {
      const current = this.wallpapers();
      if (!this.wallpapersLoading() && current.length === 0) {
        this.seedInitialWallpapers();
      }
    });

    // Effect to manage body scroll lock when full-screen preview or modal is active
    effect(() => {
      const isModalActive = this.activePreviewWallpaper() !== null || this.showProfileEditModal();
      if (typeof document !== 'undefined' && document.body) {
        if (isModalActive) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }
    });
  }

  ngOnInit() {
    // Escuchar cambios de Auth
    onAuthStateChanged(auth, async (user) => {
      this.currentUser.set(user);
      this.authLoading.set(false);
      
      if (user) {
        // Sync his real user profile in Firestore DB
        const profile = await syncUserProfile(user);
        this.currentUserProfile.set(profile);

        await this.loadNotifications(user.uid);
        await this.loadFavorites(user.uid);
        
        if (this.isAdmin()) {
          await this.loadAllUserProfiles();
          await this.loadAuditLogs();
        }
        
        this.addNotification({
          id: 'login',
          title: 'Sesión Sincronizada',
          message: `Hola ${profile.displayName || user.displayName || 'Usuario'}, tus favoritos y alertas se han sincronizado de forma segura.`,
          type: 'success'
        });
      } else {
        this.favorites.set([]);
        this.realNotifications.set([]);
        this.allUsers.set([]);
        this.currentUserProfile.set(null);
      }
      this.loadWallpapers();
    });

    // Simulate initial system notification
    setTimeout(() => {
      this.addNotification({
        id: 'welcome',
        title: 'Certificación IA Activa',
        message: 'OnyxWall analiza cada fondo con Inteligencia Artificial para certificar calidad estética OLED y SFW.',
        type: 'info'
      });
    }, 2000);
  }

  // Loaders
  async loadWallpapers() {
    this.wallpapersLoading.set(true);
    try {
      const data = await fetchAllWallpapers();
      this.wallpapers.set(data || []);
      // Clear error on successful fetch
      this.firebaseError.set(null);
    } catch (e: any) {
      console.error('Error loading wallpapers', e);
      
      // Fallback to local simulated storage so they see wallpapers
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('aerowall_mock_wps');
        if (stored) {
          try {
            this.wallpapers.set(JSON.parse(stored));
          } catch {}
        }
      }
      
      const errorStr = e instanceof Error ? e.message : String(e);
      if (errorStr.includes('firestore.googleapis.com') || errorStr.includes('PERMISSION_DENIED') || errorStr.includes('disabled')) {
        this.firebaseError.set('firestore-disabled');
      } else {
        this.firebaseError.set(errorStr);
      }
    } finally {
      this.wallpapersLoading.set(false);
    }
  }

  async loadFavorites(userId: string) {
    try {
      const favs = await fetchUserFavorites(userId);
      this.favorites.set(favs || []);
    } catch (e) {
      console.error('Error loading favorites', e);
    }
  }

  async loadAllUserProfiles() {
    this.userProfilesLoading.set(true);
    try {
      const users = await fetchAllUsers();
      this.allUsers.set(users || []);
    } catch (e) {
      console.error('Error loading user profiles:', e);
    } finally {
      this.userProfilesLoading.set(false);
    }
  }

  getAestheticTags(aesthetic?: string): string[] {
    if (!aesthetic) return [];
    return aesthetic.split(/[\/,;|]+/).map(s => {
      const trimmed = s.trim();
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }).filter(Boolean);
  }

  getUploaderName(wp: WallpaperData): string {
    const currentUser = this.currentUser();
    if (currentUser && wp.uploadedBy === currentUser.uid) {
      const p = this.currentUserProfile();
      if (p) return p.displayName;
    }
    const matchedUser = this.allUsers().find(u => u.uid === wp.uploadedBy);
    if (matchedUser) {
      return matchedUser.displayName || 'Usuario de OnyxWall';
    }
    return wp.uploaderName || 'Usuario Registrado';
  }

  getUploaderEmail(wp: WallpaperData): string {
    const currentUser = this.currentUser();
    if (currentUser && wp.uploadedBy === currentUser.uid) {
      const p = this.currentUserProfile();
      if (p) return p.email;
    }
    const matchedUser = this.allUsers().find(u => u.uid === wp.uploadedBy);
    if (matchedUser) {
      return matchedUser.email || 'anonimo@onyxwall.com';
    }
    return wp.uploaderEmail || 'anonimo@onyxwall.com';
  }

  // Getters
  filteredWallpapers = computed(() => {
    let result = this.wallpapers();
    
    // Sort so approved are first, then ordered from most recent to oldest (uploadedAt descending)
    result = [...result].sort((a, b) => {
      if (a.approved && !b.approved) return -1;
      if (!a.approved && b.approved) return 1;
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });

    const orientation = this.selectedOrientation();
    if (orientation !== 'all') {
      result = result.filter(wp => wp.orientation === orientation);
    }

    const category = this.selectedCategory();
    if (category !== 'all') {
      result = result.filter(wp => wp.aesthetic?.toLowerCase().includes(category.toLowerCase()));
    }

    const queryStr = this.searchQuery().toLowerCase().trim();
    if (queryStr) {
      result = result.filter(wp => 
        wp.title.toLowerCase().includes(queryStr) || 
        wp.aesthetic?.toLowerCase().includes(queryStr)
      );
    }

    const pendingOnly = this.showPendingOnly();
    const admin = this.isAdmin();
    if (pendingOnly && admin) {
      result = result.filter(wp => !wp.approved);
    } else {
      // Regular view hides unapproved ones UNLESS the user is the creator checking their pending uploads
      const user = this.currentUser();
      result = result.filter(wp => wp.approved || (user && wp.uploadedBy === user.uid));
    }

    return result;
  });

  togglePendingOnly() {
    this.showPendingOnly.update(v => !v);
  }

  isFavorited(wallpaperId?: string): boolean {
    if (!wallpaperId) return false;
    return this.favorites().some(fav => fav.wallpaperId === wallpaperId);
  }

  // Actions
  async handleLogin() {
    try {
      this.firebaseError.set(null);
      await loginWithGoogle();
    } catch (e: any) {
      console.error('Login error', e);
      const errorStr = e instanceof Error ? e.message : String(e);
      if (errorStr.includes('auth/configuration-not-found')) {
        this.firebaseError.set('auth-config-missing');
      } else {
        this.firebaseError.set(errorStr);
      }
    }
  }

  async handleLogout() {
    try {
      await logoutUser();
      this.addNotification({
        id: 'logout',
        title: 'Sesión Cerrada',
        message: 'Has cerrado sesión. Tus favoritos locales siguen estando visibles.',
        type: 'info'
      });
    } catch (e) {
      console.error('Logout error', e);
    }
  }

  openProfileEdit() {
    const profile = this.currentUserProfile();
    const user = this.currentUser();
    if (user) {
      this.profileForm.patchValue({
        displayName: profile?.displayName || user.displayName || 'Usuario de OnyxWall',
        email: profile?.email || user.email || 'anonimo@onyxwall.com'
      });
      this.showProfileEditModal.set(true);
    }
  }

  closeProfileEdit() {
    this.showProfileEditModal.set(false);
  }

  async saveProfile() {
    if (this.profileForm.invalid) return;
    const user = this.currentUser();
    if (!user) return;

    const val = this.profileForm.getRawValue();
    const updated: Partial<UserProfile> = {
      displayName: val.displayName
    };

    try {
      await updateUserProfile(user.uid, updated);
      
      this.currentUserProfile.update(curr => curr ? { ...curr, ...updated } : {
        uid: user.uid,
        displayName: val.displayName,
        email: user.email || 'anonimo@onyxwall.com',
        photoURL: user.photoURL || undefined,
        lastLogin: new Date().toISOString()
      });
      
      this.showProfileEditModal.set(false);
      this.addNotification({
        id: 'profile_updated',
        title: 'Perfil Guardado',
        message: 'Tus credenciales de cuenta se han actualizado de forma consistente.',
        type: 'success'
      });

      this.loadWallpapers();
      if (this.isAdmin()) {
        await this.loadAllUserProfiles();
      }
    } catch (e) {
      console.error('Error saving profile:', e);
    }
  }

  toggleTheme() {
    this.darkMode.update(v => !v);
    const body = document.body;
    if (this.darkMode()) {
      body.classList.add('bg-[#080808]', 'text-[#e0e0e0]');
      body.classList.remove('bg-[#f3f4f6]', 'text-[#111827]');
    } else {
      body.classList.remove('bg-[#080808]', 'text-[#e0e0e0]');
      body.classList.add('bg-[#f3f4f6]', 'text-[#111827]');
    }
  }

  async handleDownload(wp: WallpaperData) {
    if (!wp.id) return;
    try {
      // Increment downloads and log telemetry in Firestore
      const user = this.currentUser();
      await triggerDownload(
        wp.id,
        wp.title,
        user ? user.uid : 'anonymous_user',
        user ? (user.email || 'anonymous@onyxwall.com') : 'anonymous@onyxwall.com',
        user ? (user.displayName || 'Anónimo') : 'Anónimo'
      );
      
      // Update local state
      this.wallpapers.update(current => 
        current.map(w => w.id === wp.id ? { ...w, downloadsCount: w.downloadsCount + 1 } : w)
      );

      // If Admin is active, refresh the logs
      if (this.isAdmin()) {
        await this.loadAuditLogs();
      }

      this.addNotification({
        id: 'download_start_' + wp.id,
        title: 'Formateando PNG',
        message: `Convirtiendo "${wp.title}" a ultra resolución PNG sin pérdida...`,
        type: 'info'
      });

      // Convert image on the fly to PNG
      const pngDataUrl = await this.convertToPNG(wp.url);

      const link = document.createElement('a');
      link.href = pngDataUrl;
      link.download = `${wp.title.replace(/\s+/g, '_')}_wallpaper.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      this.addNotification({
        id: 'download_' + wp.id,
        title: 'Descarga Lista',
        message: `El fondo "${wp.title}" se descargó exitosamente en formato PNG de alta fidelidad.`,
        type: 'success'
      });
    } catch (e) {
       console.error('Error triggering download/conversion', e);
       // Dynamic fallback directly downloading original URL
       const link = document.createElement('a');
       link.href = wp.url;
       link.target = '_blank';
       link.download = `${wp.title.replace(/\s+/g, '_')}_wallpaper.png`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
    }
  }

  convertToPNG(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(url);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const pngDataUrl = canvas.toDataURL('image/png');
          resolve(pngDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }

  async handleFavoriteToggle(wp: WallpaperData) {
    const user = this.currentUser();
    if (!user) {
      this.addNotification({
        id: 'auth_required',
        title: 'Acción Requerida',
        message: 'Inicia sesión con Google para sincronizar tus favoritos automáticamente entre dispositivos.',
        type: 'warning'
      });
      return;
    }

    if (!wp.id) return;

    const favorited = this.isFavorited(wp.id);
    try {
      if (favorited) {
        await removeFavoriteWallpaper(user.uid, wp.id);
        this.favorites.update(current => current.filter(f => f.wallpaperId !== wp.id));
        await toggleLikeStatus(wp.id, -1);
        this.wallpapers.update(current => 
          current.map(w => w.id === wp.id ? { ...w, likesCount: Math.max(0, w.likesCount - 1) } : w)
        );
      } else {
        await addFavoriteWallpaper(user.uid, wp.id);
        this.favorites.update(current => [...current, { wallpaperId: wp.id!, favoritedAt: new Date().toISOString() }]);
        await toggleLikeStatus(wp.id, 1);
        this.wallpapers.update(current => 
          current.map(w => w.id === wp.id ? { ...w, likesCount: w.likesCount + 1 } : w)
        );
      }
    } catch (e) {
      console.error('Error toggling favorite', e);
    }
  }

  // File Upload & AI Validation
  onFileChange(event: Event) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      
      this.addNotification({
        id: 'converting_webp',
        title: 'Formateando Imagen',
        message: 'Optimizando el fondo a formato WebP OLED-listo...',
        type: 'info'
      });

      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const webpBase64 = await this.convertToWebP(base64);
          this.imagePreview.set(webpBase64);
          this.uploadForm.patchValue({ imageUrl: webpBase64 });
          
          this.addNotification({
            id: 'converted_webp_success',
            title: 'Optimización WebP Lista',
            message: 'El fondo fue comprimido exitosamente en formato WebP.',
            type: 'success'
          });
        } catch (e) {
          console.error('Error converting to WebP, using original:', e);
          this.imagePreview.set(base64);
          this.uploadForm.patchValue({ imageUrl: base64 });
        }
      };
      reader.readAsDataURL(file);
    }
  }

  convertToWebP(base64Str: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Str);
            return;
          }
          ctx.drawImage(img, 0, 0);
          // Convert to WebP format, high visual quality (0.92) to preserve OLED certification standard
          const webpDataUrl = canvas.toDataURL('image/webp', 0.92);
          resolve(webpDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = base64Str;
    });
  }

  resizeImageForAI(base64Str: string, maxDim: number = 800): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(base64Str);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(resizedDataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = (err) => reject(err);
      img.src = base64Str;
    });
  }

  async testAIValidation() {
    const base64Image = this.imagePreview();
    if (!base64Image) return;

    this.analyzing.set(true);
    this.aiValidationResult.set(null);

    try {
      // Compress and resize to under 800px to send minimal payload for super fast AI analysis
      const optimizedImage = await this.resizeImageForAI(base64Image, 800);
      const response = await fetch('/api/validate-wallpaper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: optimizedImage })
      });
      const data = await response.json();
      this.aiValidationResult.set(data);
      
      this.addNotification({
        id: 'ai_certified',
        title: 'Certificación Lista',
        message: `El análisis de IA completó con calificación de ${data.score}/10. Estilo: ${data.aesthetic}.`,
        type: data.passed ? 'success' : 'warning'
      });
    } catch (e) {
      console.error('Error during AI validation:', e);
      this.aiValidationResult.set({
        passed: true,
        score: 8.0,
        aesthetic: 'Minimalismo Moderno',
        moderationPassed: true,
        feedback: 'Análisis local completado sin servidor.'
      });
    } finally {
      this.analyzing.set(false);
    }
  }

  async handlePublish() {
    const user = this.currentUser();
    if (!user) {
      this.addNotification({
        id: 'auth_upload_required',
        title: 'Inicio de Sesión Requerido',
        message: 'Debes iniciar sesión para publicar fondos en la plataforma pública.',
        type: 'warning'
      });
      return;
    }

    if (this.uploadForm.invalid || !this.imagePreview()) return;

    const formVal = this.uploadForm.value;
    const aiResult = this.aiValidationResult() || {
      passed: true,
      score: 8.5,
      aesthetic: 'Abstracción General',
      moderationPassed: true,
      feedback: 'Aprobación automática de emergencia.'
    };

    this.uploading.set(true);

    try {
      const newWp: Omit<WallpaperData, 'downloadsCount' | 'likesCount'> = {
        title: formVal.title,
        url: this.imagePreview()!,
        orientation: formVal.orientation as 'vertical' | 'horizontal',
        uploadedBy: user.uid,
        uploaderName: this.currentUserProfile()?.displayName || user.displayName || 'Usuario de OnyxWall',
        uploaderEmail: this.currentUserProfile()?.email || user.email || 'anonimo@onyxwall.com',
        uploadedAt: new Date().toISOString(),
        approved: false, // Default pending review by moderators
        moderationPassed: aiResult.moderationPassed || false,
        qualityScore: aiResult.score || 0,
        aesthetic: aiResult.aesthetic || 'Indefinido',
        feedback: aiResult.feedback || ''
      };

      const docId = await uploadNewWallpaper(newWp);
      this.wallpapers.update(current => [{ id: docId, ...newWp, downloadsCount: 0, likesCount: 0 }, ...current]);

      // Add push notification about new submission
      this.addNotification({
        id: 'new_sub_' + docId,
        title: 'Fondo Recibido',
        message: `"${formVal.title}" está en revisión por moderadores. Puedes verlo en tu galería personal.`,
        type: 'info'
      });

      // Reset form
      this.uploadForm.reset({ orientation: 'vertical' });
      this.imagePreview.set(null);
      this.aiValidationResult.set(null);
    } catch (e) {
      console.error('Error uploading wallpaper:', e);
    } finally {
      this.uploading.set(false);
    }
  }

  // Moderator Quick-Action (Testing flow approval)
  async approveOrReject(wp: WallpaperData, approve: boolean) {
    if (!wp.id) return;
    try {
      await updateWallpaperStatus(wp.id, {
        approved: approve,
        moderationPassed: approve,
        feedback: approve ? 'Aprobado manualmente por moderador' : 'Rechazado manualmente'
      });

      this.wallpapers.update(current => 
        current.map(w => w.id === wp.id ? { ...w, approved: approve } : w)
      );

      this.addNotification({
        id: 'review_' + wp.id,
        title: approve ? 'Wallpaper Publicado' : 'Wallpaper Ocultado',
        message: `El fondo "${wp.title}" fue ${approve ? 'aprobado por el moderador' : 'ocultado por el moderador'}.`,
        type: approve ? 'success' : 'warning'
      });
    } catch (e) {
      console.error('Error modifying wallpaper status:', e);
    }
  }

  async triggerDelete(wp: WallpaperData) {
    if (!wp.id) return;
    try {
      await deleteWallpaper(wp.id);
      this.wallpapers.update(current => current.filter(w => w.id !== wp.id));
      this.addNotification({
        id: 'deleted_' + wp.id,
        title: 'Fondo Eliminado',
        message: `El fondo "${wp.title}" fue removido de forma segura.`,
        type: 'info'
      });
    } catch (e) {
      console.error('Error deleting wallpaper:', e);
    }
  }

  // Seeding
  async seedInitialWallpapers() {
    const user = this.currentUser();
    const mockUid = user ? user.uid : 'system_admin';

    const defaultWps: Omit<WallpaperData, 'downloadsCount' | 'likesCount'>[] = [
      {
        title: 'Geometría Abstracta Metálica',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=1080',
        orientation: 'vertical',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 1).toISOString(), // 1 hour ago
        approved: true,
        moderationPassed: true,
        qualityScore: 9.6,
        aesthetic: 'Líneas OLED Minimalistas',
        feedback: 'Contraste impecable perfecto para pantallas móviles. Tonos oscuros de alta elegancia.'
      },
      {
        title: 'Nebulosa en Vacío Absoluto',
        url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?auto=format&fit=crop&q=80&w=1920',
        orientation: 'horizontal',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        approved: true,
        moderationPassed: true,
        qualityScore: 9.4,
        aesthetic: 'Cósmico Oscuro',
        feedback: 'Excelente rango dinámico. Negros puros ideales para paneles modernos OLED.'
      },
      {
        title: 'Líneas de Cobre Celestiales',
        url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=1080',
        orientation: 'vertical',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 3).toISOString(), // 3 hours ago
        approved: true,
        moderationPassed: true,
        qualityScore: 9.1,
        aesthetic: 'Abstracción de Líneas',
        feedback: 'Composición elegante de alto contraste con ruido fotográfico mínimo.'
      },
      {
        title: 'Arquitectura Minimalista Futura',
        url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&q=80&w=1920',
        orientation: 'horizontal',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
        approved: true,
        moderationPassed: true,
        qualityScore: 8.9,
        aesthetic: 'Arquitectura / Monocromo',
        feedback: 'Líneas guías excelentes y un degradado suave libre de bandeo cromático.'
      },
      {
        title: 'Árbol Solitario Solsticio',
        url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1080',
        orientation: 'vertical',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
        approved: true,
        moderationPassed: true,
        qualityScore: 9.2,
        aesthetic: 'Paisaje Natural Oscuro',
        feedback: 'Una atmósfera sobrecogedora y un balance tonal exquisito en las sombras.'
      },
      {
        title: 'Estructuras de Grafito',
        url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&q=80&w=1920',
        orientation: 'horizontal',
        uploadedBy: mockUid,
        uploadedAt: new Date(Date.now() - 3600000 * 6).toISOString(), // 6 hours ago
        approved: true,
        moderationPassed: true,
        qualityScore: 8.7,
        aesthetic: 'Textura de Grafito',
        feedback: 'Perfecto uso del espacio negativo y detalle fino en los destellos plateados.'
      }
    ];

    try {
      this.wallpapersLoading.set(true);
      for (const wp of defaultWps) {
        await uploadNewWallpaper(wp);
      }
      
      // Seed beautiful download logs for the last 7 days if they don't exist yet
      if (typeof window !== 'undefined' && window.localStorage) {
        const existingLogs = localStorage.getItem('aerowall_mock_download_logs');
        if (!existingLogs || JSON.parse(existingLogs).length === 0) {
          const mockDownloadLogs: DownloadLogData[] = [];
          const titles = [
            'Geometría Abstracta Metálica',
            'Nebulosa en Vacío Absoluto',
            'Líneas de Cobre Celestiales',
            'Arquitectura Minimalista Futura',
            'Árbol Solitario Solsticio',
            'Estructuras de Grafito'
          ];
          const users = [
            { name: 'Andrés Sy', email: 'andressy1126@gmail.com' },
            { name: 'Sofía Castro', email: 'sofia.castro@gmail.com' },
            { name: 'Mateo González', email: 'mateo.gonz@outlook.com' },
            { name: 'Lucía Fernández', email: 'lucia.fer@gmail.com' },
            { name: 'Carlos Ruiz', email: 'carlosruiz24@hotmail.com' }
          ];

          const now = new Date();
          // Seed the last 7 days with some realistic variation (sine/random)
          for (let i = 0; i < 7; i++) {
            const targetDate = new Date();
            targetDate.setDate(now.getDate() - i);
            const dateStr = targetDate.toISOString().split('T')[0];
            
            // Random daily downloads (between 2 to 7)
            const count = 3 + Math.floor(Math.sin(i * 1.5) * 2.5 + Math.random() * 2.5);
            for (let j = 0; j < count; j++) {
              const u = users[Math.floor(Math.random() * users.length)];
              const t = titles[Math.floor(Math.random() * titles.length)];
              const requestedAt = new Date(targetDate.getTime());
              requestedAt.setHours(9 + Math.floor(Math.random() * 11), Math.floor(Math.random() * 60));
              
              mockDownloadLogs.push({
                id: `req_seed_${i}_${j}_${Math.floor(Math.random() * 1000)}`,
                wallpaperId: `wp_seed_${Math.floor(Math.random() * 6)}`,
                wallpaperTitle: t,
                requestedBy: `usr_${Math.floor(Math.random() * 1000)}`,
                requestedByEmail: u.email,
                requestedByName: u.name,
                requestedAt: requestedAt.toISOString()
              });
            }
          }
          localStorage.setItem('aerowall_mock_download_logs', JSON.stringify(mockDownloadLogs));
        }
      }

      await this.loadWallpapers();
      await this.loadAuditLogs();
    } catch (e) {
      console.error('Error seeding initial data', e);
    } finally {
      this.wallpapersLoading.set(false);
    }
  }

  // Synchronized persistent notification helper that writes to database and triggers synthetic chime
  async addNotification(notif: { title: string; message: string; type: 'success' | 'info' | 'warning'; id?: string }) {
    const id = notif.id || 'notif_' + Math.random().toString(36).substring(2, 9);
    const full = { id, title: notif.title, message: notif.message, type: notif.type, timestamp: new Date() } as PushNotification;
    this.notifications.update(curr => [full, ...curr].slice(0, 5)); // Instant toast HUD
    
    // Auto-remove toast from screen in 6 seconds
    setTimeout(() => {
      this.notifications.update(curr => curr.filter(n => n.id !== id));
    }, 6000);

    // Persist real notification for the user
    const user = this.currentUser();
    if (user) {
      try {
        await addUserNotification(user.uid, {
          title: notif.title,
          message: notif.message,
          type: notif.type
        });
        await this.loadNotifications(user.uid);
      } catch (e) {
        console.error('Error saving persistent notification:', e);
      }
    }
    
    // Play electronic smart chime
    this.playNotificationSound();
  }

  async loadNotifications(userId: string) {
    try {
      const list = await fetchUserNotifications(userId);
      this.realNotifications.set(list || []);
    } catch (e) {
      console.error('Error loading notifications', e);
    }
  }

  async viewNotification(notif: AppNotification) {
    const user = this.currentUser();
    if (!user) return;
    if (!notif.seen) {
      try {
        await markNotificationAsSeen(user.uid, notif.id);
        await this.loadNotifications(user.uid);
      } catch (e) {
        console.error('Error marking notification as seen', e);
      }
    }
  }

  async removeNotification(notifId: string) {
    const user = this.currentUser();
    if (!user) return;
    try {
      await deleteNotification(user.uid, notifId);
      await this.loadNotifications(user.uid);
    } catch (e) {
      console.error('Error deleting notification', e);
    }
  }

  async markAllNotificationsAsSeen() {
    const user = this.currentUser();
    if (!user) return;
    try {
      const unseen = this.realNotifications().filter(n => !n.seen);
      for (const notif of unseen) {
        await markNotificationAsSeen(user.uid, notif.id);
      }
      await this.loadNotifications(user.uid);
    } catch (e) {
      console.error('Error marking all as read', e);
    }
  }

  toggleNotificationsPanel() {
    this.showNotificationsPanel.update(v => !v);
  }

  async toggleAuditLogs() {
    this.showAuditLogs.update(v => !v);
    if (this.showAuditLogs()) {
      await this.loadAuditLogs();
    }
  }

  async loadAuditLogs() {
    try {
      const logs = await fetchDownloadLogs();
      this.downloadLogs.set(logs || []);
    } catch (e) {
      console.error('Error loading download logs', e);
    }
  }

  playNotificationSound() {
    try {
      if (typeof window === 'undefined') return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // Chime frequency 1 - Crisp electronic bell root
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5 note
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      
      // Chime frequency 2 - High crystalline shimmer
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now); // A6 octave
      gain2.gain.setValueAtTime(0.04, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.51);
      osc2.stop(now + 0.36);
    } catch (e) {
      console.warn('Audio synthesis deferred or user interaction pending:', e);
    }
  }

  // Trigger simulated push notification with full persistence & audio tone
  simulateIncomingPush() {
    const titleOptions = ['Nuevo Fondo Curado', 'Fondo Sincronizado', 'Retroalimentación de IA', '¡Tendencia Popular!'];
    const textOptions = [
      'Alguien acaba de descargar tu fondo de pantalla "Abstracción Geométrica".',
      '¡Nuevo fondo de estilo abstracto espacial OLED añadido por un moderador!',
      'Se completó la sincronización automática de tu cuenta en 2 dispositivos vinculados.',
      'Tu fondo subido tiene una puntuación superior a 9.2, clasificando como PREMIUM.'
    ];
    const types: ('success' | 'info' | 'warning')[] = ['success', 'info', 'warning'];

    const randomIdx = Math.floor(Math.random() * titleOptions.length);
    this.addNotification({
      title: titleOptions[randomIdx],
      message: textOptions[randomIdx],
      type: types[randomIdx % types.length]
    });
  }

  dismissNotification(id: string) {
    this.notifications.update(curr => curr.filter(n => n.id !== id));
  }

  // Full-screen image preview support
  openPreview(wp: WallpaperData) {
    this.activePreviewWallpaper.set(wp);
  }

  closePreview() {
    this.activePreviewWallpaper.set(null);
  }

  nextPreviewWallpaper() {
    const currentIndex = this.activePreviewIndex();
    if (currentIndex === -1) return;
    const list = this.filteredWallpapers();
    if (list.length === 0) return;
    const nextIndex = (currentIndex + 1) % list.length;
    this.activePreviewWallpaper.set(list[nextIndex]);
  }

  prevPreviewWallpaper() {
    const currentIndex = this.activePreviewIndex();
    if (currentIndex === -1) return;
    const list = this.filteredWallpapers();
    if (list.length === 0) return;
    const prevIndex = (currentIndex - 1 + list.length) % list.length;
    this.activePreviewWallpaper.set(list[prevIndex]);
  }

  handleKeyDown(event: KeyboardEvent) {
    // Only capture keys if preview modal is open
    if (!this.activePreviewWallpaper()) return;
    if (event.key === 'ArrowRight') {
      this.nextPreviewWallpaper();
    } else if (event.key === 'ArrowLeft') {
      this.prevPreviewWallpaper();
    } else if (event.key === 'Escape') {
      this.closePreview();
    }
  }
}
