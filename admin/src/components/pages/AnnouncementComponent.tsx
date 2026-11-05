import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Bell, CheckCircle, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/axios';

interface Announcement {
    title: string;
    body: string | null;
    recipients: number;
    sentAt: string;
}

const NO_SCREEN = '';

/**
 * Send a notification to every active app user: it lands in their in-app inbox and, where
 * notifications are allowed, as a push. Tapping it can open one of the app's main screens.
 */
const AnnouncementComponent: React.FC = () => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [screen, setScreen] = useState(NO_SCREEN);
    const [screens, setScreens] = useState<{ value: string; label: string }[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState<number | null>(null);
    const [history, setHistory] = useState<Announcement[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true);
        try {
            const res = await api.get('/admin/notifications/announcements');
            setHistory(res.data?.data || []);
        } catch {
            setHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    useEffect(() => {
        api.get('/admin/notifications/screens').then(res => setScreens(res.data?.data || [])).catch(() => setScreens([]));
        loadHistory();
    }, [loadHistory]);

    const send = async () => {
        setError('');
        setSentTo(null);
        if (!title.trim()) {
            setError('A title is required.');
            return;
        }
        if (!window.confirm(`Send "${title.trim()}" to all app users? This can't be undone.`)) return;
        setSending(true);
        try {
            const res = await api.post('/admin/notifications/broadcast', {
                title: title.trim(),
                body: body.trim() || null,
                screen: screen || null,
            });
            setSentTo(res.data?.data?.recipients ?? 0);
            setTitle('');
            setBody('');
            setScreen(NO_SCREEN);
            // Delivery continues in the background; refresh the list shortly after.
            setTimeout(loadHistory, 3000);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send the notification.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-xl">
                        <Bell className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">Notifications</h2>
                        <p className="text-gray-500 text-sm">Send a message to every app user: in their notification inbox, and as a push where allowed</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-red-600">{error}</p>
                    </div>
                )}
                {sentTo !== null && (
                    <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                        <p className="text-sm text-teal-700">Sending to {sentTo} user{sentTo === 1 ? '' : 's'}. It can take a minute to reach everyone.</p>
                    </div>
                )}

                <div className="space-y-4 max-w-2xl">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title <span className="text-red-500">*</span></Label>
                        <Input value={title} maxLength={150} onChange={e => setTitle(e.target.value)} placeholder="e.g. New diet plans are here" />
                        <p className="text-[10px] text-gray-400 text-right">{title.length}/150</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</Label>
                        <Textarea rows={4} value={body} maxLength={1000} onChange={e => setBody(e.target.value)} placeholder="What users should know" />
                        <p className="text-[10px] text-gray-400 text-right">{body.length}/1000</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open when tapped</Label>
                        <select
                            value={screen}
                            onChange={e => setScreen(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                            <option value={NO_SCREEN}>Just open the app</option>
                            {screens.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </div>
                    <Button className="bg-teal-500 hover:bg-teal-600 text-white" onClick={send} disabled={sending}>
                        {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                        {sending ? 'Sending...' : 'Send to all users'}
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent notifications</h3>
                {loadingHistory ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-500" /></div>
                ) : history.length === 0 ? (
                    <p className="text-sm text-gray-400 py-4">Nothing sent yet.</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {history.map((a, i) => (
                            <div key={`${a.title}-${i}`} className="py-3 flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-sm font-semibold text-gray-900">{a.title}</div>
                                    {a.body && <div className="text-sm text-gray-500 line-clamp-2">{a.body}</div>}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <div className="text-xs font-semibold text-teal-700">{a.recipients} users</div>
                                    <div className="text-[11px] text-gray-400">{new Date(a.sentAt).toLocaleString()}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnnouncementComponent;
