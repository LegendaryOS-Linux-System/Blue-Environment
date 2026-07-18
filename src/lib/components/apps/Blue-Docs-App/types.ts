export type DocFormat = 'rich' | 'markdown' | 'spreadsheet' | 'presentation';

export interface DocFile {
  id: string; name: string; format: DocFormat; content: string;
  path?: string; modified: boolean; created: Date; updated: Date;
}

export interface TextStyle {
  bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean;
  color?: string; bgColor?: string; fontSize?: number; fontFamily?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  heading?: 0 | 1 | 2 | 3; list?: 'bullet' | 'ordered' | 'none'; link?: string;
}
