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
    AlertTriangle,
    Skull,
    Trash2,
    Settings,
    Calendar,

} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    cleanupByAgeAction,
    cleanupByIdsAction,
    getAutoCleanupSettingsAction,
    updateAutoCleanupSettingsAction
} from "@/app/actions/cleanup";

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
    requestsByHourByCountry: {
        hour: number;
        countries: { country: string; countryCode: string; count: number }[]
    }[];
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

    const [panicMode, setPanicMode] = useState(false);
    const [showPanicConfirm, setShowPanicConfirm] = useState(false);

    // Cleanup State
    const [showCleanupDropdown, setShowCleanupDropdown] = useState(false);
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const [autoCleanupDays, setAutoCleanupDays] = useState(15);
    const [showCleanupSettings, setShowCleanupSettings] = useState(false);
    const [cleanupLoading, setCleanupLoading] = useState(false);
    const [hoveredSeries, setHoveredSeries] = useState<number | null>(null);

    // Fetch Settings (Panic + Cleanup)
    useEffect(() => {
        fetch("/api/dashboard/settings")
            .then(res => res.json())
            .then(data => {
                if (data.success) setPanicMode(data.panicMode);
            })
            .catch(console.error);

        getAutoCleanupSettingsAction()
            .then(data => {
                if (data.success && typeof data.autoCleanupDays === 'number') {
                    const days = data.autoCleanupDays;
                    setAutoCleanupDays(days);
                    // Run auto-cleanup check silently
                    if (days > 0) {
                        import("@/app/actions/cleanup").then(({ runAutoCleanupAction }) => {
                            runAutoCleanupAction().then(res => {
                                if (res.success && typeof res.deletedCount === 'number' && res.deletedCount > 0) {
                                    toast.success(`Auto-cleaned ${res.deletedCount} old logs`);
                                    fetchData(true);
                                }
                            });
                        });
                    }
                }
            })
            .catch(console.error);
    }, []);

    // Cleanup by Age (Server Action)
    const cleanupByAge = async (days: number) => {
        setCleanupLoading(true);
        setShowCleanupDropdown(false);
        try {
            const data = await cleanupByAgeAction(days);
            if (data.success) {
                toast.success(data.message);
                fetchData(true);
            } else {
                toast.error(data.error);
            }
        } catch {
            toast.error("Cleanup failed");
        } finally {
            setCleanupLoading(false);
        }
    };

    // Cleanup Selected (Server Action)
    const cleanupSelected = async () => {
        if (selectedLogs.size === 0) {
            toast.error("No logs selected");
            return;
        }
        setCleanupLoading(true);
        try {
            const data = await cleanupByIdsAction(Array.from(selectedLogs));
            if (data.success) {
                toast.success(data.message);
                setSelectedLogs(new Set());
                fetchData(true);
            } else {
                toast.error(data.error);
            }
        } catch {
            toast.error("Cleanup failed");
        } finally {
            setCleanupLoading(false);
        }
    };

    // Update Auto-Cleanup Settings (Server Action)
    const updateAutoCleanup = async (days: number) => {
        try {
            const data = await updateAutoCleanupSettingsAction(days);
            if (data.success && data.autoCleanupDays !== undefined) {
                setAutoCleanupDays(data.autoCleanupDays);
                toast.success(data.message);
            } else {
                toast.error(data.error);
            }
        } catch {
            toast.error("Failed to update settings");
        }
    };

    // Execute Panic Toggle (Actual Logic)
    const executePanicToggle = async () => {
        const newStatus = !panicMode;
        setPanicMode(newStatus); // Optimistic
        setShowPanicConfirm(false); // Close modal if open

        try {
            const res = await fetch("/api/dashboard/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ panicMode: newStatus }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
            } else {
                setPanicMode(!newStatus); // Revert
                toast.error(data.error);
            }
        } catch (err) {
            setPanicMode(!newStatus); // Revert
            toast.error("Failed to update settings");
        }
    };

    // Handle Panic Button Click
    const handlePanicClick = () => {
        if (!panicMode) {
            // Enable: Show Confirmation
            setShowPanicConfirm(true);
        } else {
            // Disable: Execute immediately
            executePanicToggle();
        }
    };

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

            <div className="relative z-10 p-6 w-full mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
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

                    {/* Action Buttons - Responsive */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => fetchData(true)}
                            disabled={refreshing}
                            className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                            <span className="hidden sm:inline">REFRESH</span>
                        </button>

                        <button
                            onClick={handlePanicClick}
                            className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all border ${panicMode
                                ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'}`}
                        >
                            {panicMode ? <Skull size={14} /> : <AlertTriangle size={14} />}
                            <span className="hidden sm:inline">{panicMode ? "PANIC ACTIVE" : "PANIC"}</span>
                        </button>

                        {/* Cleanup Button with Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowCleanupDropdown(!showCleanupDropdown)}
                                disabled={cleanupLoading}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-lg transition-all disabled:opacity-50"
                            >
                                <Trash2 size={14} className={cleanupLoading ? "animate-pulse" : ""} />
                                <span className="hidden sm:inline">CLEANUP</span>
                            </button>

                            <AnimatePresence>
                                {showCleanupDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-56 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50"
                                    >
                                        <div className="p-2 border-b border-white/5">
                                            <div className="text-[10px] text-zinc-500 uppercase px-2 py-1">Clear Logs Older Than</div>
                                        </div>
                                        <div className="p-1">
                                            {[7, 15, 30, 60, 90].map(days => (
                                                <button
                                                    key={days}
                                                    onClick={() => cleanupByAge(days)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 rounded-lg transition-colors"
                                                >
                                                    <Calendar size={12} className="text-amber-400" />
                                                    <span>{days} days</span>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="p-2 border-t border-white/5">
                                            <button
                                                onClick={() => { setShowCleanupDropdown(false); setShowCleanupSettings(true); }}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                <Settings size={12} />
                                                <span>Auto-Cleanup Settings</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Panic Mode Banner */}
                <AnimatePresence>
                    {panicMode && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-xl overflow-hidden"
                        >
                            <div className="p-4 flex items-center justify-center gap-3 text-red-400">
                                <Skull className="w-5 h-5 animate-pulse" />
                                <span className="font-bold tracking-wide">SYSTEM LOCKDOWN IN EFFECT — ALL UPLOADS REJECTED</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                        <motion.div variants={itemVariants} className="lg:col-span-2 p-6 rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-sm font-medium text-zinc-400">
                                <Clock size={16} />
                                <h3>24-HOUR ACTIVITY</h3>
                            </div>

                            <div className="w-full flex-1 flex flex-col">
                                {(() => {
                                    const hourlyData = stats?.requestsByHourByCountry || Array.from({ length: 24 }, (_, i) => ({ hour: i, countries: [] }));
                                    const totalData = stats?.requestsByHour || Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));

                                    // Get all unique countries across all hours
                                    const allCountries = new Map<string, { country: string; countryCode: string }>();
                                    hourlyData.forEach(h => {
                                        h.countries.forEach(c => {
                                            if (!allCountries.has(c.country)) {
                                                allCountries.set(c.country, { country: c.country, countryCode: c.countryCode });
                                            }
                                        });
                                    });
                                    const countryList = Array.from(allCountries.values());

                                    // Color generator (matching country list)
                                    const getColor = (index: number) => {
                                        const hue = (index * 137.508) % 360;
                                        return `hsl(${hue}, 70%, 60%)`;
                                    };

                                    const max = Math.max(...totalData.map(d => d.count), 5);
                                    const height = 200;
                                    const width = 1000;
                                    const xStep = width / 23;

                                    // Build stacked data per hour
                                    const stackedData = hourlyData.map((h, hourIndex) => {
                                        let cumulative = 0;
                                        const stacks = countryList.map((c, countryIndex) => {
                                            const countryData = h.countries.find(hc => hc.country === c.country);
                                            const count = countryData?.count || 0;
                                            const y0 = height - (cumulative / max) * height;
                                            cumulative += count;
                                            const y1 = height - (cumulative / max) * height;
                                            return { country: c.country, countryCode: c.countryCode, count, y0, y1, colorIndex: countryIndex };
                                        });
                                        return { hour: h.hour, x: hourIndex * xStep, stacks, total: cumulative };
                                    });

                                    return (
                                        <div className="flex flex-col w-full flex-1 h-full">
                                            {/* Chart Container */}
                                            <div className="relative w-full flex-1 min-h-[200px] group/chart">
                                                <svg
                                                    viewBox={`0 0 ${width} ${height}`}
                                                    preserveAspectRatio="none"
                                                    className="absolute inset-0 w-full h-full overflow-visible"
                                                >
                                                    {/* Grid Lines */}
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <line
                                                            key={i}
                                                            x1="0" y1={i * (height / 4)}
                                                            x2={width} y2={i * (height / 4)}
                                                            stroke="white" strokeOpacity="0.05" strokeDasharray="4 4"
                                                            vectorEffect="non-scaling-stroke"
                                                        />
                                                    ))}

                                                    {/* Stacked Area Fills */}
                                                    {countryList.map((c, countryIndex) => {
                                                        // Build path for this country's area
                                                        const areaPoints = stackedData.map(h => {
                                                            const stack = h.stacks[countryIndex];
                                                            return { x: h.x, y0: stack.y0, y1: stack.y1 };
                                                        });

                                                        // Top line (y1) going forward
                                                        const topLine = areaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y1}`).join(' ');
                                                        // Bottom line (y0) going backward  
                                                        const bottomLine = areaPoints.slice().reverse().map((p, i) => `${i === 0 ? 'L' : 'L'} ${p.x},${p.y0}`).join(' ');

                                                        const pathD = `${topLine} ${bottomLine} Z`;
                                                        const color = getColor(countryIndex);

                                                        const isHovered = hoveredSeries === countryIndex;
                                                        const isDimmed = hoveredSeries !== null && hoveredSeries !== countryIndex;

                                                        // Dynamic Styles
                                                        const currentFillOpacity = isHovered ? 0.9 : (isDimmed ? 0.1 : 0.6);
                                                        const currentStrokeOpacity = isHovered ? 1 : (isDimmed ? 0.2 : 1);
                                                        const zIndex = isHovered ? 10 : 0;

                                                        return (
                                                            <path
                                                                key={c.country}
                                                                d={pathD}
                                                                fill={color}
                                                                fillOpacity={currentFillOpacity}
                                                                stroke={color}
                                                                strokeOpacity={currentStrokeOpacity}
                                                                strokeWidth={isHovered ? 2 : 1}
                                                                vectorEffect="non-scaling-stroke"
                                                                className={`transition-all duration-300 ease-in-out cursor-pointer ${isHovered ? 'brightness-125' : ''}`}
                                                                onMouseEnter={() => setHoveredSeries(countryIndex)}
                                                                onMouseLeave={() => setHoveredSeries(null)}
                                                                style={{ position: 'relative', zIndex }}
                                                            />
                                                        );
                                                    })}
                                                </svg>

                                                {/* HTML Interaction Layer */}
                                                <div className="absolute inset-0 w-full h-full">
                                                    {stackedData.map((h, i) => {
                                                        const left = (i / 23) * 100;
                                                        const top = h.total > 0 ? 100 - ((h.total / max) * 100) : 100;

                                                        return (
                                                            <div
                                                                key={i}
                                                                className="absolute group/point w-8 h-full -ml-4"
                                                                style={{ left: `${left}%` }}
                                                            >
                                                                <div className="absolute inset-0 hover:bg-white/5 transition-colors rounded-sm" />

                                                                {/* Tooltip */}
                                                                <div
                                                                    className="absolute opacity-0 group-hover/point:opacity-100 scale-95 group-hover/point:scale-100 transition-all pointer-events-none z-20 left-1/2 -translate-x-1/2"
                                                                    style={{ top: `${Math.max(top - 5, 5)}%` }}
                                                                >
                                                                    <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-2xl transform -translate-y-full mb-2 min-w-[120px]">
                                                                        <div className="text-[11px] text-zinc-400 font-mono whitespace-nowrap text-center border-b border-white/10 pb-1 mb-1">
                                                                            {h.hour.toString().padStart(2, '0')}:00
                                                                        </div>
                                                                        {h.stacks.filter(s => s.count > 0).slice(0, 5).map((s, si) => (
                                                                            <div key={si} className="flex items-center justify-between gap-2 text-[10px]">
                                                                                <div className="flex items-center gap-1">
                                                                                    <span
                                                                                        className="w-2 h-2 rounded-full"
                                                                                        style={{ backgroundColor: getColor(s.colorIndex) }}
                                                                                    />
                                                                                    <span className="text-zinc-400">{s.countryCode}</span>
                                                                                </div>
                                                                                <span className="font-bold text-zinc-200">{s.count}</span>
                                                                            </div>
                                                                        ))}
                                                                        {h.stacks.filter(s => s.count > 0).length > 5 && (
                                                                            <div className="text-[9px] text-zinc-500 text-center mt-1">
                                                                                +{h.stacks.filter(s => s.count > 0).length - 5} more
                                                                            </div>
                                                                        )}
                                                                        <div className="text-xs font-bold text-indigo-400 text-center border-t border-white/10 pt-1 mt-1">
                                                                            {h.total} total
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* X-Axis Labels */}
                                            <div className="flex justify-between text-[10px] text-zinc-600 font-medium pt-3 px-1 border-t border-white/5 mt-auto">
                                                <span>00:00</span>
                                                <span>06:00</span>
                                                <span>12:00</span>
                                                <span>18:00</span>
                                                <span>23:00</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>

                        {/* Geographic Distribution */}
                        <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-[#0a0a10]/60 backdrop-blur-xl border border-white/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-6 text-sm font-medium text-zinc-400">
                                <Globe size={16} />
                                <h3>TOP REGIONS</h3>
                            </div>

                            <div className="flex-1 flex flex-col items-center gap-6">
                                {/* Custom SVG Donut Chart */}
                                <div className="relative w-40 h-40 flex-shrink-0">
                                    {stats?.requestsByCountry.length === 0 ? (
                                        <div className="absolute inset-0 flex items-center justify-center rounded-full border border-white/5 bg-white/5">
                                            <span className="text-xs text-zinc-600">No Data</span>
                                        </div>
                                    ) : (
                                        <svg viewBox="0 0 100 100" className="rotate-[-90deg]">
                                            {(() => {
                                                const total = stats?.totalRequests || 1;

                                                // Use all data points directly
                                                const data = stats?.requestsByCountry || [];

                                                let currentAngle = 0;
                                                return data.map((item, i) => {
                                                    const percentage = (item.count / total) * 100;
                                                    const radius = 40;
                                                    const circumference = 2 * Math.PI * radius;
                                                    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

                                                    // Generate unique HSL color based on Golden Angle
                                                    const hue = (i * 137.508) % 360;  // Golden angle approximation
                                                    const color = `hsl(${hue}, 70%, 60%)`;

                                                    const segment = (
                                                        <circle
                                                            key={i}
                                                            cx="50"
                                                            cy="50"
                                                            r={radius}
                                                            fill="transparent"
                                                            stroke={color}
                                                            strokeWidth="12"
                                                            strokeDasharray={strokeDasharray}
                                                            strokeLinecap="round"
                                                            transform={`rotate(${currentAngle} 50 50)`}
                                                            className="transition-all duration-500 hover:opacity-80 cursor-pointer"
                                                        />
                                                    );

                                                    currentAngle += (percentage / 100) * 360;
                                                    return segment;
                                                });
                                            })()}
                                        </svg>
                                    )}
                                    {/* Center Stats */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-2xl font-bold">{stats?.requestsByCountry.length || 0}</span>
                                        <span className="text-[10px] text-zinc-500 uppercase">Countries</span>
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex-1 w-full space-y-3 overflow-y-auto max-h-[220px] custom-scrollbar pr-2">
                                    {stats?.requestsByCountry.map((country, i) => {
                                        // Golden Angle Color (Matching Chart)
                                        const hue = (i * 137.508) % 360;
                                        const color = `hsl(${hue}, 70%, 60%)`;
                                        const percentage = Math.round((country.count / (stats?.totalRequests || 1)) * 100);

                                        return (
                                            <div key={i} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <span className="text-xs font-bold bg-white/5 w-6 h-6 flex items-center justify-center rounded text-zinc-400">{country.countryCode || "XX"}</span>
                                                    <span className="text-xs font-medium text-zinc-300 truncate max-w-[100px]">{country.country}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono text-zinc-500">{country.count}</span>
                                                    <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-zinc-500 w-10 text-center">{percentage}%</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
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
            {/* Panic Confirmation Modal */}
            <AnimatePresence>
                {showPanicConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowPanicConfirm(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-[#0a0a10] border border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 overflow-hidden"
                        >
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-500" />

                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-4 text-red-500">
                                    <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                                        <Skull size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Enable Panic Mode?</h3>
                                        <p className="text-xs text-red-400 font-medium">SYSTEM LOCKDOWN PROTOCOL</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <p className="text-sm text-zinc-400 leading-relaxed">
                                        This will immediately <span className="text-red-400 font-bold">BLOCK ALL INCOMING UPLOADS</span>.
                                        No files or logs will be accepted until you manually disable this mode.
                                    </p>

                                    <div className="p-3 bg-red-500/5 rounded-lg border border-red-500/10 flex gap-2.5">
                                        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-zinc-500">
                                            Current active sessions will be interrupted. Use this only in case of emergency or maintenance.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        onClick={() => setShowPanicConfirm(false)}
                                        className="flex-1 px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        onClick={executePanicToggle}
                                        className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <Skull size={14} className="group-hover:animate-pulse" />
                                        ACTIVATE LOCKDOWN
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Cleanup Settings Modal */}
            <AnimatePresence>
                {showCleanupSettings && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowCleanupSettings(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-md bg-[#0a0a10] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500" />

                            <div className="p-6 space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                                        <Settings size={24} className="text-amber-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Auto-Cleanup Settings</h3>
                                        <p className="text-xs text-amber-400 font-medium">Scheduled log cleanup</p>
                                    </div>
                                </div>

                                <div className="space-y-4 pt-2">
                                    <p className="text-sm text-zinc-400">
                                        Automatically delete logs older than the specified days when the dashboard loads.
                                        Set to <span className="text-amber-400 font-bold">0</span> to disable.
                                    </p>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-zinc-500">Days</span>
                                            <span className="text-xs font-bold text-amber-400">{autoCleanupDays === 0 ? 'Disabled' : `${autoCleanupDays} days`}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={365}
                                            value={autoCleanupDays}
                                            onChange={(e) => setAutoCleanupDays(parseInt(e.target.value))}
                                            style={{
                                                background: `linear-gradient(to right, #f59e0b ${(autoCleanupDays / 365) * 100}%, #27272a ${(autoCleanupDays / 365) * 100}%)`
                                            }}
                                            className="w-full h-2 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-500 [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-all"
                                        />
                                        <div className="flex justify-between text-[10px] text-zinc-600">
                                            <span>Off</span>
                                            <span>90</span>
                                            <span>180</span>
                                            <span>365</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-4">
                                    <button
                                        onClick={() => setShowCleanupSettings(false)}
                                        className="flex-1 px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        CANCEL
                                    </button>
                                    <button
                                        onClick={() => { updateAutoCleanup(autoCleanupDays); setShowCleanupSettings(false); }}
                                        className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Calendar size={14} />
                                        SAVE SETTINGS
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
