import { MongoClient, Db, Collection, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "logs_sender";

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export interface LogEntry {
    _id?: string;
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
    createdAt: Date;
}

export interface User {
    _id?: ObjectId;
    username: string;
    passwordHash: string;
    role: 'admin' | 'user';
    createdAt: Date;
}

export interface Session {
    _id: string; // Session ID (random string)
    userId: string;
    expiresAt: Date;
}

export interface RequestStats {
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

export async function connectToDatabase(): Promise<{
    client: MongoClient;
    db: Db;
}> {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    // Create indexes for better query performance
    const logsCollection = db.collection<LogEntry>("logs");
    await logsCollection.createIndex({ createdAt: -1 });
    await logsCollection.createIndex({ chatId: 1 });
    await logsCollection.createIndex({ ip: 1 });
    await logsCollection.createIndex({ country: 1 });

    // Create indexes for users and sessions
    const usersCollection = db.collection<User>("users");
    await usersCollection.createIndex({ username: 1 }, { unique: true });

    // Sessions auto-expire using MongoDB TTL
    const sessionsCollection = db.collection<Session>("sessions");
    await sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    return { client, db };
}

export async function getLogsCollection(): Promise<Collection<LogEntry>> {
    const { db } = await connectToDatabase();
    return db.collection<LogEntry>("logs");
}

export async function getUsersCollection(): Promise<Collection<User>> {
    const { db } = await connectToDatabase();
    return db.collection<User>("users");
}

export async function getSessionsCollection(): Promise<Collection<Session>> {
    const { db } = await connectToDatabase();
    return db.collection<Session>("sessions");
}

export async function saveLog(log: Omit<LogEntry, "_id">): Promise<void> {
    const collection = await getLogsCollection();
    await collection.insertOne(log as LogEntry);
}

export async function getLogs(
    page: number = 1,
    limit: number = 50,
    filters?: { search?: string; status?: string; country?: string }
): Promise<{ logs: LogEntry[]; total: number }> {
    const collection = await getLogsCollection();

    const query: Record<string, unknown> = {};

    if (filters?.search) {
        const searchRegex = new RegExp(filters.search, "i"); // Case-insensitive
        query.$or = [
            { chatId: searchRegex },
            { filename: searchRegex },
            { ip: searchRegex },
            { country: searchRegex },
            { city: searchRegex },
            { caption: searchRegex },
        ];
    }

    if (filters?.status) query.status = filters.status;
    if (filters?.country) query.country = filters.country;

    const total = await collection.countDocuments(query);
    const logs = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

    return { logs, total };
}

export async function getStats(): Promise<RequestStats> {
    const collection = await getLogsCollection();

    const [
        totalRequests,
        successCount,
        failedCount,
        uniqueIpsResult,
        uniqueCountriesResult,
        totalDataResult,
        countryStats,
        hourlyStats,
        hourlyCountryStats,
        recentLogs,
    ] = await Promise.all([
        collection.countDocuments(),
        collection.countDocuments({ status: "success" }),
        collection.countDocuments({ status: "failed" }),
        collection.distinct("ip"),
        collection.distinct("country"),
        collection.aggregate([
            { $group: { _id: null, total: { $sum: "$contentSize" } } }
        ]).toArray(),
        collection.aggregate([
            { $match: { country: { $exists: true, $ne: null } } },
            { $group: { _id: { country: "$country", code: "$countryCode" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray(),
        collection.aggregate([
            {
                $group: {
                    _id: { $hour: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray(),
        // Per-country hourly breakdown
        collection.aggregate([
            { $match: { country: { $exists: true, $ne: null } } },
            {
                $group: {
                    _id: {
                        hour: { $hour: "$createdAt" },
                        country: "$country",
                        code: "$countryCode"
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id.hour": 1, count: -1 } }
        ]).toArray(),
        collection.find().sort({ createdAt: -1 }).limit(10).toArray(),
    ]);

    return {
        totalRequests,
        successCount,
        failedCount,
        uniqueIps: uniqueIpsResult.length,
        uniqueCountries: uniqueCountriesResult.filter(Boolean).length,
        totalDataSize: totalDataResult[0]?.total || 0,
        requestsByCountry: countryStats.map((s) => ({
            country: s._id.country || "Unknown",
            countryCode: s._id.code || "XX",
            count: s.count,
        })),
        requestsByHour: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            count: hourlyStats.find((h) => h._id === i)?.count || 0,
        })),
        // Transform per-country hourly data into nested structure
        requestsByHourByCountry: Array.from({ length: 24 }, (_, hour) => ({
            hour,
            countries: hourlyCountryStats
                .filter((s) => s._id.hour === hour)
                .map((s) => ({
                    country: s._id.country || "Unknown",
                    countryCode: s._id.code || "XX",
                    count: s.count,
                }))
        })),
        recentLogs,
    };
}

// Auth Helpers
export async function createUser(user: User): Promise<void> {
    const collection = await getUsersCollection();
    await collection.insertOne(user);
}

export async function findUserByUsername(username: string): Promise<User | null> {
    const collection = await getUsersCollection();
    return collection.findOne({ username });
}

export async function getUserCount(): Promise<number> {
    const collection = await getUsersCollection();
    return collection.countDocuments();
}

export async function createSession(session: Session): Promise<void> {
    const collection = await getSessionsCollection();
    await collection.insertOne(session);
}

export async function getSession(sessionId: string): Promise<Session | null> {
    const collection = await getSessionsCollection();
    return collection.findOne({ _id: sessionId });
}

export async function deleteSession(sessionId: string): Promise<void> {
    const collection = await getSessionsCollection();
    await collection.deleteOne({ _id: sessionId });
}

export async function findUserById(userId: string): Promise<User | null> {
    const collection = await getUsersCollection();
    try {
        return collection.findOne({ _id: new ObjectId(userId) });
    } catch {
        return null;
    }
}

// Blocked IP Helpers
export interface BlockedIp {
    _id?: string;
    ip: string;
    reason?: string;
    blockedAt: Date;
    blockedBy?: string;
}

export async function getBlockedIpsCollection(): Promise<Collection<BlockedIp>> {
    const { db } = await connectToDatabase();
    return db.collection<BlockedIp>("blocked_ips");
}

export async function blockIp(ip: string, reason: string = "Manual block"): Promise<void> {
    const collection = await getBlockedIpsCollection();
    await collection.updateOne(
        { ip },
        { $set: { ip, reason, blockedAt: new Date() } },
        { upsert: true }
    );
}

export async function unblockIp(ip: string): Promise<void> {
    const collection = await getBlockedIpsCollection();
    await collection.deleteOne({ ip });
}

export async function isIpBlocked(ip: string): Promise<boolean> {
    const collection = await getBlockedIpsCollection();
    const count = await collection.countDocuments({ ip }, { limit: 1 });
    return count > 0;
}

export async function getBlockedIps(): Promise<string[]> {
    const collection = await getBlockedIpsCollection();
    const docs = await collection.find({}, { projection: { ip: 1 } }).toArray();
    return docs.map(d => d.ip);
}

// Global Settings (Panic Mode)
export interface GlobalSettings {
    _id: "global_settings";
    panicMode: boolean;
    autoCleanupDays?: number; // 0 = disabled, default 15
    updatedAt: Date;
    updatedBy?: string;
}

export async function getSettingsCollection(): Promise<Collection<GlobalSettings>> {
    const { db } = await connectToDatabase();
    return db.collection<GlobalSettings>("settings");
}

export async function getPanicMode(): Promise<boolean> {
    const collection = await getSettingsCollection();
    const settings = await collection.findOne({ _id: "global_settings" });
    return settings?.panicMode || false;
}

export async function setPanicMode(enabled: boolean, username?: string): Promise<void> {
    const collection = await getSettingsCollection();
    await collection.updateOne(
        { _id: "global_settings" },
        {
            $set: {
                panicMode: enabled,
                updatedAt: new Date(),
                updatedBy: username
            }
        },
        { upsert: true }
    );
}

// Log Cleanup Functions
export async function deleteLogsByAge(daysOld: number): Promise<number> {
    const collection = await getLogsCollection();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await collection.deleteMany({ createdAt: { $lt: cutoffDate } });
    return result.deletedCount;
}

export async function deleteLogsByIds(ids: string[]): Promise<number> {
    const collection = await getLogsCollection();
    const objectIds = ids.map(id => {
        try {
            return new ObjectId(id);
        } catch {
            return null;
        }
    }).filter((id): id is ObjectId => id !== null);

    if (objectIds.length === 0) return 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await collection.deleteMany({ _id: { $in: objectIds } } as any);
    return result.deletedCount;
}

export async function getAutoCleanupDays(): Promise<number> {
    const collection = await getSettingsCollection();
    const settings = await collection.findOne({ _id: "global_settings" });
    return settings?.autoCleanupDays ?? 15; // Default 15 days
}

export async function setAutoCleanupDays(days: number, username?: string): Promise<void> {
    const collection = await getSettingsCollection();
    await collection.updateOne(
        { _id: "global_settings" },
        {
            $set: {
                autoCleanupDays: days,
                updatedAt: new Date(),
                updatedBy: username
            }
        },
        { upsert: true }
    );
}

export async function runAutoCleanup(): Promise<number> {
    const days = await getAutoCleanupDays();
    if (days <= 0) return 0; // Disabled
    return deleteLogsByAge(days);
}
