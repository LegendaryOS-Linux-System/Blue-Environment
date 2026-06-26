import { Inbox, Send, FileText, Trash2, Archive, ShieldX } from 'lucide-react';

export interface EmailAddress {
    name: string;
    email: string;
}

export interface Attachment {
    name: string;
    size: string;
    type: string;
}

export interface Email {
    id: string;
    from: EmailAddress;
    to: EmailAddress[];
    cc?: EmailAddress[];
    subject: string;
    body: string;
    bodyHtml?: string;
    date: Date;
    read: boolean;
    starred: boolean;
    labels: string[];
    attachments?: Attachment[];
    folder: 'inbox' | 'sent' | 'drafts' | 'archive' | 'spam' | 'trash';
    threadId?: string;
}

export interface ComposeData {
    to: string;
    cc: string;
    subject: string;
    body: string;
    replyTo?: Email;
}

export type ReplyMode = 'reply' | 'replyAll' | 'forward' | null;

export const FOLDERS = [
    { id: 'inbox', icon: Inbox, label: 'Inbox' },
    { id: 'sent', icon: Send, label: 'Sent' },
    { id: 'drafts', icon: FileText, label: 'Drafts' },
    { id: 'archive', icon: Archive, label: 'Archive' },
    { id: 'spam', icon: ShieldX, label: 'Spam' },
    { id: 'trash', icon: Trash2, label: 'Trash' },
] as const;

export type FolderType = typeof FOLDERS[number]['id'];

export const EMPTY_COMPOSE: ComposeData = { to: '', cc: '', subject: '', body: '' };
