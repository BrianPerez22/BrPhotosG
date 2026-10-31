export interface Perms { view: boolean; download: boolean; upload: boolean; delete: boolean }
export interface Me { id: string; username: string; role: 'admin' | 'user'; perms: Perms; folders: string[]; createdAt?: string }
export interface FolderEntry { name: string; path: string; cover: string | null; count: number; subfolders: number }
export interface FileEntry {
  name: string;
  path: string;
  type: 'image' | 'video';
  size: number;
  /** Timestamp de modificación del archivo en el sistema de ficheros */
  mtime: number;
  /** Timestamp de captura real (EXIF DateTimeOriginal) o mtime si no hay EXIF */
  cdate: number;
}
export interface Listing {
  path: string;
  parent: string | null;
  crumbs: { name: string; path: string }[];
  /** true cuando path='' y se listan las bibliotecas como raíces */
  isLibraryRoot: boolean;
  /** Nombres de las bibliotecas disponibles */
  libraries: string[];
  folders: FolderEntry[];
  files: FileEntry[];
  canWrite: boolean;
}
export interface UserInput { username?: string; password?: string; role?: 'admin' | 'user'; perms?: Perms; folders?: string[] }
