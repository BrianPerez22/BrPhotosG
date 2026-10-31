export interface Perms { view: boolean; download: boolean; upload: boolean; delete: boolean }
export interface Me { id: string; username: string; role: 'admin' | 'user'; perms: Perms; folders: string[]; createdAt?: string }
export interface FolderEntry { name: string; path: string; cover: string | null; count: number; subfolders: number }
export interface FileEntry { name: string; path: string; type: 'image' | 'video'; size: number; mtime: number }
export interface Listing {
  path: string;
  parent: string | null;
  crumbs: { name: string; path: string }[];
  folders: FolderEntry[];
  files: FileEntry[];
  canWrite: boolean;
}
export interface UserInput { username?: string; password?: string; role?: 'admin' | 'user'; perms?: Perms; folders?: string[] }
