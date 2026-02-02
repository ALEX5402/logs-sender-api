"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Activity,
    CheckCircle2,
    XCircle,
    Globe,
    Users,
    FileText,
    HardDrive,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    Terminal,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Lock,
    Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface LogEntry {
    _id: string;
    chatId: string;
    filename: string;
    contentType: "file" | "text";
    contentSize: number;
    caption?: string;
    ip: string;
    country?: string;
    city?: string;
    countryCode?: string;
    latitude?: number;
    longitude?: number;
    userAgent?: string;
    status: "success" | "failed";
    errorMessage?: string;
    createdAt: string;
}

interface Stats {
    totalRequests: number;
    successCount: number;
    failedCount: number;
    uniqueIps: number;
    uniqueCountries: number;
    totalDataSize: number;
    requestsByCountry: { country: string; countryCode: string; count: number }[];
    requestsByHour: { hour: number; count: number }[];
    recentLogs: LogEntry[];
}

interface DashboardData {
    logs: LogEntry[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    stats: Stats | null;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// Format relative time with short style
function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return "just now";
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        search: "",
        status: "",
        country: "",
    });
    const [refreshing, setRefreshing] = useState(false);
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [blockedIps, setBlockedIps] = useState<Set<string>>(new Set());

    // Toggle IP Block
    const toggleIpBlock = async (ip: string) => {
        const isBlocked = blockedIps.has(ip);
        const newBlocked = new Set(blockedIps);

        // Optimistic update
        if (isBlocked) newBlocked.delete(ip);
        else newBlocked.add(ip);
        setBlockedIps(newBlocked);

        try {
            const method = isBlocked ? "DELETE" : "POST";
            const res = await fetch("/api/dashboard/block-ip", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ip }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success(isBlocked ? `Unblocked ${ip}` : `Blocked ${ip}`);
            } else {
                // Revert
                setBlockedIps(prev => {
                    const revert = new Set(prev);
                    if (isBlocked) revert.add(ip); else revert.delete(ip);
                    return revert;
                });
                toast.error(data.error);
            }
        } catch {
            // Revert
            setBlockedIps(prev => {
                const revert = new Set(prev);
                if (isBlocked) revert.add(ip); else revert.delete(ip);
                return revert;
            });
            toast.error("Failed to update status");
        }
    };

    // Need to fetch blocked IPs list on load, but for now we can rely on manual toggle or add fetching if needed.
    // Actually, distinct IPs should probably be checked? Or just rely on user interaction.
    // Ideally we fetch the list. Let's assume we don't for this 'simple' toggle unless requested, 
    // OR we can make a new endpoint to get all blocked IPs.
    // Let's add a quick fetch in useEffect. Wait, fetching ALL blocked IPs might be heavy if many.
    // Let's just track locally for now or lazy fetch if user complaints.
    // User asked "toggle button", so visual feedback is key.

    // I will add a fetch to get blocked IPs to sync state.
    const fetchBlockedIps = useCallback(async () => {
        // This needs an endpoint. I added getBlockedIps in database but not exposed in API.
        // Let's Skip fetching all for now and trust the user to block what they see. 
        // Actually, if I refresh, I won't know what's blocked. That's bad UX.
        // I should expose the list in the stats or dashboard API.
    }, []);


    const fetchData = useCallback(async (isRefresh = false) => {
        try {
            if (isRefresh) setRefreshing(true);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
            });

            if (filters.search) params.append("search", filters.search);
            if (filters.status) params.append("status", filters.status);
            if (filters.country) params.append("country", filters.country);

            const response = await fetch(`/api/dashboard?${params}`);
            const result = await response.json();

            if (result.success) {
                setData(result.data);
                if (result.data.blockedIps) {
                    setBlockedIps(new Set(result.data.blockedIps));
                }
                if (isRefresh) toast.success("Dashboard updated");
            } else {
                toast.error(result.error || "Failed to fetch data");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Network error");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, filters]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(() => fetchData(), 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#050508] text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                        <Terminal className="text-white w-6 h-6" />
                    </div>
                    <div className="text-zinc-400 font-mono text-sm animate-pulse">Initializing System...</div>
                </div>
            </div>
        );
    }

    const stats = data?.stats;
    const maxHourlyCount = Math.max(...(stats?.requestsByHour.map((h) => h.count) || [1]));
    const maxCountryCount = stats?.requestsByCountry[0]?.count || 1;

    return (
        <div className="min-h-screen bg-[#050508] text-zinc-100 font-mono selection:bg-indigo-500/30">
            {/* Dynamic Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/5 blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px]" />
            </div>

            <div className="relative z-10 p-6 max-w-[1600px] mx-auto space-y-8">
                {/* Header */}
                <header className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Terminal className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Logs Analytics</h1>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>System Online</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                        REFRESH
                    </button>
                </header>

                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-6"
                >
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {[
                            { label: "Total Requests", value: stats?.totalRequests, icon: Activity, color: "text-indigo-400" },
                            { label: "Successful", value: stats?.successCount, icon: CheckCircle2, color: "text-emerald-400" },
                            { label: "Failed", value: stats?.failedCount, icon: XCircle, color: "text-rose-400" },
                            { label: "Unique IPs", value: stats?.uniqueIps, icon: Users, color: "text-blue-400" },
                            { label: "Countries", value: stats?.uniqueCountries, icon: Globe, color: "text-amber-400" },
                            { label: "Data Volume", value: formatBytes(stats?.totalDataSize || 0), icon: HardDrive, color: "text-cyan-400" },
                        ].map((stat, i) => (
                            <motion.div
                                key={i}
                                variants={itemVariants}
                                className="p-5 rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5 hover:border-white/10 transition-colors group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2 rounded-lg bg-white/5 ${stat.color} group-hover:bg-white/10 transition-colors`}>
                                        <stat.icon size={18} />
                                    </div>
                                    {i === 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">99.9%</span>}
                                </div>
                                <div className="text-2xl font-bold mb-1 tracking-tight">
                                    {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                                </div>
                                <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Charts & Maps */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Hourly Activity */}
                        <motion.div variants={itemVariants} className="lg:col-span-2 p-6 rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5">
                            <div className="flex items-center gap-2 mb-6 text-sm font-medium text-zinc-400">
                                <Clock size={16} />
                                <h3>24-HOUR ACTIVITY</h3>
                            </div>

                            <div className="h-[240px] flex items-end gap-1.5 pb-2">
                                {stats?.requestsByHour.map((item, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-end group relative h-full">
                                        <div
                                            className="w-full bg-indigo-500/20 rounded-t-sm group-hover:bg-indigo-500 transition-all duration-300 relative overflow-hidden"
                                            style={{ height: `${Math.max((item.count / maxHourlyCount) * 100, 4)}%` }}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/0 to-indigo-500/20" />
                                        </div>
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-xs rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                            {item.hour}:00 • {item.count} reqs
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-600 font-medium pt-2 border-t border-white/5">
                                <span>00:00</span>
                                <span>06:00</span>
                                <span>12:00</span>
                                <span>18:00</span>
                                <span>23:00</span>
                            </div>
                        </motion.div>

                        {/* Geographic Distribution */}
                        <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-sm font-medium text-zinc-400">
                                <MapPin size={16} />
                                <h3>TOP REGIONS</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {stats?.requestsByCountry.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-2">
                                        <Globe size={24} className="opacity-20" />
                                        <span className="text-xs">No data yet</span>
                                    </div>
                                ) : (
                                    stats?.requestsByCountry.map((country, i) => (
                                        <div key={i} className="group">
                                            <div className="flex items-center justify-between mb-2 text-sm">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-bold bg-zinc-800/50 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400">{country.countryCode || "XX"}</span>
                                                    <span className="font-medium text-zinc-300">{country.country}</span>
                                                </div>
                                                <span className="font-mono text-zinc-500">{country.count}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                                                    style={{ width: `${(country.count / maxCountryCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Logs Table */}
                    <motion.div variants={itemVariants} className="rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5 overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-zinc-400">
                                <FileText size={16} />
                                <h3>RECENT LOGS</h3>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative group">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <input
                                        type="text"
                                        placeholder="Search logs..."
                                        value={filters.search}
                                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                        className="h-9 pl-9 pr-4 bg-black/20 border border-white/5 rounded-lg text-xs focus:outline-none focus:border-indigo-500/50 w-full md:w-64 transition-all"
                                    />
                                </div>

                                {/* Custom Status Dropdown */}
                                <div className="relative z-20">
                                    <button
                                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                        onBlur={() => setTimeout(() => setShowStatusDropdown(false), 200)}
                                        className="h-9 px-3 flex items-center gap-2 bg-black/20 border border-white/5 rounded-lg text-xs hover:bg-white/5 hover:border-white/10 transition-all min-w-[120px] justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            {filters.status === 'success' ? (
                                                <div className="flex items-center gap-1.5 text-emerald-400">
                                                    <CheckCircle2 size={12} />
                                                    <span>Success</span>
                                                </div>
                                            ) : filters.status === 'failed' ? (
                                                <div className="flex items-center gap-1.5 text-rose-400">
                                                    <XCircle size={12} />
                                                    <span>Failed</span>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400">All Status</span>
                                            )}
                                        </div>
                                        <ChevronRight size={12} className={`text-zinc-500 transition-transform duration-200 ${showStatusDropdown ? 'rotate-90' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {showStatusDropdown && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                className="absolute right-0 top-full mt-2 w-32 bg-[#0a0a10] border border-white/10 rounded-xl shadow-xl shadow-black/50 overflow-hidden"
                                            >
                                                <div className="p-1 space-y-0.5">
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, status: "" }))}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${!filters.status ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                                                    >
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                                                        All Status
                                                    </button>
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, status: "success" }))}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${filters.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                                                    >
                                                        <CheckCircle2 size={12} />
                                                        Success
                                                    </button>
                                                    <button
                                                        onClick={() => setFilters(prev => ({ ...prev, status: "failed" }))}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors ${filters.status === 'failed' ? 'bg-rose-500/10 text-rose-400' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                                                    >
                                                        <XCircle size={12} />
                                                        Failed
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-white/5 text-zinc-500 uppercase tracking-wider bg-white/[0.02]">
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium">Chat ID</th>
                                        <th className="px-6 py-4 font-medium">File / Type</th>
                                        <th className="px-6 py-4 font-medium">Size</th>
                                        <th className="px-6 py-4 font-medium">Origin</th>
                                        <th className="px-6 py-4 font-medium text-right">Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <AnimatePresence>
                                        {data?.logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-12 text-center text-zinc-600">
                                                    No logs found matching your criteria
                                                </td>
                                            </tr>
                                        ) : (
                                            data?.logs.map((log) => (
                                                <motion.tr
                                                    key={log._id}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="group hover:bg-white/[0.02] transition-colors"
                                                >
                                                    <td className="px-6 py-3">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${log.status === 'success'
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                                            <span className="text-[10px] font-medium uppercase">{log.status}</span>
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3 font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                                        {log.chatId}
                                                    </td>
                                                    <td className="px-6 py-3 text-zinc-300">
                                                        <div className="flex items-center gap-2">
                                                            {log.filename}
                                                            <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] text-zinc-500 uppercase">{log.contentType}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-zinc-400">
                                                        {formatBytes(log.contentSize)}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-2 bg-white/5 py-1 px-2 rounded hover:bg-white/10 transition-colors group/ip">
                                                                <span className={`text-[10px] font-mono ${blockedIps.has(log.ip) ? 'text-rose-400 line-through opacity-70' : 'text-zinc-400'}`}>
                                                                    {log.ip}
                                                                </span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); toggleIpBlock(log.ip); }}
                                                                    className={`w-7 h-4 rounded-full transition-colors relative ml-1 ${blockedIps.has(log.ip) ? 'bg-rose-500' : 'bg-zinc-700/50 hover:bg-zinc-700'}`}
                                                                    title={blockedIps.has(log.ip) ? "Unblock IP" : "Block IP"}
                                                                >
                                                                    <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform duration-200 ${blockedIps.has(log.ip) ? 'translate-x-3' : 'translate-x-0'}`} />
                                                                </button>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-zinc-300 ml-2">
                                                                <span className="text-[10px] font-bold text-zinc-500 bg-white/5 px-1 rounded">{log.countryCode || "XX"}</span>
                                                                <span className="truncate max-w-[100px]">{log.city || log.country || "Unknown"}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-zinc-500 font-mono">
                                                        {formatRelativeTime(log.createdAt)}
                                                    </td>
                                                </motion.tr>
                                            ))
                                        )}
                                    </AnimatePresence>
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {data && data.pagination.totalPages > 1 && (
                            <div className="p-4 border-t border-white/5 flex items-center justify-between">
                                <span className="text-xs text-zinc-500">
                                    Page {data.pagination.page} of {data.pagination.totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                                        disabled={page === data.pagination.totalPages}
                                        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
