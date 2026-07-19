// src/types/fileSystemAccess.d.ts
//
// Ambient declarations filling the gaps TypeScript's lib.dom.d.ts (TS 5.6.2)
// leaves in the File System Access API. Verified by inspecting
// node_modules/typescript/lib/lib.dom.d.ts before writing this file: it
// already ships FileSystemHandle, FileSystemFileHandle, createWritable(),
// FileSystemWritableFileStream, and the global PermissionState
// ("granted" | "denied" | "prompt") type. Only two things are actually
// missing — showSaveFilePicker on Window, and queryPermission /
// requestPermission on FileSystemHandle — so only those are declared here,
// as merges into the existing global interfaces (not fresh types).

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  /** Optional: some implementations only expose requestPermission. */
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
}

interface Window {
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}
