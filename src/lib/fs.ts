import { join } from "@tauri-apps/api/path";
import { readDir } from "@tauri-apps/plugin-fs";

export const loadFiles = async (dirPath: string): Promise<Array<{ name: string, path: string }>> => {
    try {
        const entries = await readDir(dirPath);
        // Just filter and map path, DO NOT read file content here
        const filtered = await Promise.all(entries
            .filter(entry => entry.isFile && /^.*\.png$/i.test(entry.name))
            .map(async entry => {
                const path = await join(dirPath, entry.name);
                return {
                    name: entry.name,
                    path: path
                };
            }));

        // Sort natural order
        filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        return filtered;
    } catch (err) {
        console.error("Failed to read directory", err);
        return [];
    }
};