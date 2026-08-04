export interface Child {
  id: string;
  name: string;
  gender?: string | null;
  dateOfBirth?: string | null;
  avatarUrl?: string | null;
}

export interface Family {
  id: string;
  name: string;
  children: Child[];
  showPhotoLocation?: boolean;
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
  createdAt: string;
}
