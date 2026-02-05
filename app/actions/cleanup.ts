"use server";

import { getCurrentUser } from "@/app/lib/auth";
import {
    deleteLogsByAge,
    deleteLogsByIds,
    getAutoCleanupDays,
    setAutoCleanupDays,
    runAutoCleanup
} from "@/app/lib/database";

/**
 * Server Action: Cleanup logs by age
 * Only accessible by admin from frontend
 */
export async function cleanupByAgeAction(days: number) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    if (typeof days !== 'number' || days < 1) {
        return { success: false, error: "Invalid days parameter" };
    }

    const deletedCount = await deleteLogsByAge(days);
    return { success: true, deletedCount, message: `Deleted ${deletedCount} log(s)` };
}

/**
 * Server Action: Cleanup logs by IDs (bulk delete)
 * Only accessible by admin from frontend
 */
export async function cleanupByIdsAction(ids: string[]) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: false, error: "Invalid ids parameter" };
    }

    const deletedCount = await deleteLogsByIds(ids);
    return { success: true, deletedCount, message: `Deleted ${deletedCount} log(s)` };
}

/**
 * Server Action: Run auto cleanup
 * Only accessible by admin from frontend
 */
export async function runAutoCleanupAction() {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    const deletedCount = await runAutoCleanup();
    return { success: true, deletedCount, message: `Deleted ${deletedCount} log(s)` };
}

/**
 * Server Action: Get auto cleanup settings
 * Accessible by authenticated users
 */
export async function getAutoCleanupSettingsAction() {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: "Unauthorized" };
    }

    const autoCleanupDays = await getAutoCleanupDays();
    return { success: true, autoCleanupDays };
}

/**
 * Server Action: Update auto cleanup settings
 * Only accessible by admin from frontend
 */
export async function updateAutoCleanupSettingsAction(days: number) {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
        return { success: false, error: "Unauthorized" };
    }

    if (typeof days !== 'number' || days < 0) {
        return { success: false, error: "Invalid days parameter" };
    }

    await setAutoCleanupDays(days, user.username);
    return {
        success: true,
        autoCleanupDays: days,
        message: days === 0 ? "Auto-cleanup disabled" : `Auto-cleanup set to ${days} days`
    };
}
