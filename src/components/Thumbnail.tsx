import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { clsx } from "clsx";

// Lazy loading thumbnail component
export const Thumbnail = ({ file, index, id, isDraggable = true, onDelete }: { file: { name: string, path: string }, index: number, id: string, isDraggable?: boolean, onDelete?: () => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [src, setSrc] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to detect visibility
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Load once
                }
            },
            { rootMargin: '200px' } // Preload margin
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, []);

    // Load image when visible
    useEffect(() => {
        if (!isVisible) return;
        if (file.path === "BLANK_PAGE") return; // Skip loading for blank pages

        let objectUrl: string | null = null;
        let isMounted = true;

        // ... inside lazy loading useEffect ...
        const load = async () => {
            // Use backend thumbnail generation to save memory and parsing time
            try {
                // Returns number[] (Vec<u8>), convert to Uint8Array then Blob
                const bytes = await invoke<number[]>('get_thumbnail', { path: file.path });
                const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
                objectUrl = URL.createObjectURL(blob);
                if (isMounted) setSrc(objectUrl);
            } catch (err) {
                console.error(`Failed to load thumbnail for ${file.name}`, err);
            }
        };

        load();

        return () => {
            isMounted = false;
            // Cleanup memory
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [isVisible, file.path, file.name]);

    return (
        <div
            ref={isDraggable ? setNodeRef : null}
            style={isDraggable ? style : undefined}
            {...(isDraggable ? attributes : {})}
            {...(isDraggable ? listeners : {})}
            className={clsx(
                "flex flex-col gap-2 group relative",
                isDraggable && "cursor-grab active:cursor-grabbing",
                isDragging && "z-50 opacity-50 scale-105 active:cursor-grabbing"
            )}
        >
            <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 group-hover:border-main transition-colors relative">
                {file.path === "BLANK_PAGE" ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white text-gray-400">
                        <span className="text-xs font-bold border-2 border-dashed border-gray-300 px-2 py-1 rounded">BLANK PAGE</span>
                    </div>
                ) : src ? (
                    <img src={src} alt={file.name} className="w-full h-full object-cover pointer-events-none" />
                ) : (
                    <div ref={imgRef} className="absolute inset-0 flex items-center justify-center text-gray-400 dark:text-gray-500 font-bold text-2xl">
                        {index + 1}
                    </div>
                )}

                {/* Delete Button */}
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer z-10"
                        title="削除"
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
            <div className="bg-gray-100 dark:bg-[#1a1a1a] px-2 py-1 rounded text-xs text-center text-gray-600 dark:text-gray-300 truncate pointer-events-none transition-colors">
                {file.name}
            </div>
        </div>
    );
};
