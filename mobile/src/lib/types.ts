export type Gender = 'male' | 'female';

export interface Child {
  id: string;
  familyId?: string;
  name: string;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
}

export interface MemberUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
}

export type Permission = 'view_only' | 'upload' | 'share_download' | 'all';

export interface Member {
  id: string;
  userId: string;
  familyId?: string;
  /** Access level on the family. 'all' == co-parent full access. */
  permissions?: Permission | null;
  accessPerChild?: 'all' | string[] | null;
  user?: MemberUser | null;
}

export interface Invitation {
  id: string;
  email: string;
  permissions?: Permission | null;
  expiresAt?: string;
  createdAt?: string;
}

export interface Family {
  id: string;
  name: string;
  ownerId?: string;
  children: Child[];
  members?: Member[];
  showPhotoLocation?: boolean;
}

/** Current signed-in user (from GET /api/auth/me). */
export interface Me {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  plan?: string | null;
}

/** Storage usage for a family (from GET /api/families/:id/usage). */
export interface FamilyUsage {
  plan: string;
  usedVideoBytes: number;
  videoLimitBytes: number | null;
  usedTotalBytes: number;
  videoCount: number;
  photoCount: number;
}

export interface Reaction {
  id: string;
  type: string;
  userId: string;
  user?: { id: string; name?: string | null } | null;
}

export interface Comment {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  user?: { id: string; name?: string | null; avatarUrl?: string | null } | null;
}

export interface Memory {
  id: string;
  fileType: 'photo' | 'video';
  fileUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  childIds: string[];
  ageLabels?: string[];
  locationCity?: string | null;
  locationState?: string | null;
  processing?: boolean;
  /** When the photo/video was taken (EXIF). The API sorts the feed by this. */
  capturedAt?: string | null;
  createdAt: string;
  // Present on the detail endpoint (GET /memories/:id):
  reactions?: Reaction[];
  comments?: Comment[];
  uploadedBy?: { id: string; name?: string | null; avatarUrl?: string | null } | null;
}

export interface Milestone {
  id: string;
  childId: string;
  type: string;
  value: string;
  unit?: string | null;
  note?: string | null;
  date: string;
  createdAt?: string;
}

export type ReelType = 'annual' | 'monthly' | 'birthday' | 'holiday';

/** A time-period collection of memories from GET /api/reels. */
export interface Reel {
  key: string;
  label: string;
  memories: Memory[];
}
