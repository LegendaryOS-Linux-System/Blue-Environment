import React from 'react';
import { Star, StarOff, Reply, ReplyAll, Forward, Archive, Trash2, X, FileText, Paperclip } from 'lucide-react';
import { MailState } from './useMailState';

interface Props {
    state: MailState;
}

const EmailViewer: React.FC<Props> = ({ state }) => {
    const { selectedEmail, toggleStar, openReply, moveToFolder, deleteEmail, setSelectedEmail } = state;
    if (!selectedEmail) return null;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-slate-800/30">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-white">{selectedEmail.subject}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {selectedEmail.from.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white">{selectedEmail.from.name}</div>
                                <div className="text-xs text-slate-400">&lt;{selectedEmail.from.email}&gt;</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            <span>To: {selectedEmail.to.map(t => t.email).join(', ')}</span>
                            <span>{selectedEmail.date.toLocaleString()}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleStar(selectedEmail.id)} className="p-2 hover:bg-white/10 rounded-lg" title="Star">
                            {selectedEmail.starred
                                ? <Star size={16} className="text-yellow-400 fill-yellow-400" />
                                : <StarOff size={16} className="text-slate-400" />}
                        </button>
                        <button onClick={() => openReply('reply')} className="p-2 hover:bg-white/10 rounded-lg" title="Reply">
                            <Reply size={16} className="text-slate-400" />
                        </button>
                        <button onClick={() => openReply('replyAll')} className="p-2 hover:bg-white/10 rounded-lg" title="Reply All">
                            <ReplyAll size={16} className="text-slate-400" />
                        </button>
                        <button onClick={() => openReply('forward')} className="p-2 hover:bg-white/10 rounded-lg" title="Forward">
                            <Forward size={16} className="text-slate-400" />
                        </button>
                        <button onClick={() => moveToFolder(selectedEmail.id, 'archive')} className="p-2 hover:bg-white/10 rounded-lg" title="Archive">
                            <Archive size={16} className="text-slate-400" />
                        </button>
                        <button onClick={() => deleteEmail(selectedEmail.id)} className="p-2 hover:bg-red-500/20 rounded-lg" title="Delete">
                            <Trash2 size={16} className="text-red-400" />
                        </button>
                        <button onClick={() => setSelectedEmail(null)} className="p-2 hover:bg-white/10 rounded-lg ml-1">
                            <X size={16} className="text-slate-400" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl">
                    <pre className="text-sm text-slate-200 whitespace-pre-wrap break-words font-sans leading-relaxed">
                        {selectedEmail.body}
                    </pre>
                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-white/5">
                            <div className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1">
                                <Paperclip size={12} /> {selectedEmail.attachments.length} attachment(s)
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                {selectedEmail.attachments.map((att, i) => (
                                    <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 text-xs">
                                        <FileText size={14} className="text-blue-400" />
                                        <span className="text-slate-200">{att.name}</span>
                                        <span className="text-slate-500">{att.size}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmailViewer;
