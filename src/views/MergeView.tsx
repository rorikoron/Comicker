import { useEffect, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { open } from '@tauri-apps/plugin-dialog';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { useSearch } from '@tanstack/react-router';
import { loadFiles } from '../lib/fs';
import { Thumbnail } from '../components/Thumbnail';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const MergeView = () => {
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [items, setItems] = useState<Array<{ id: string, type: 'Image' | 'Blank', path: string, name: string }>>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const search = useSearch({ strict: false });

    // Settings state
    // const [insertBlank, setInsertBlank] = useState(false); // Removed

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        // if queryparam exist, set to selectedPath
        const refresh = async () => {
            if (!search.bleededImagePath) return;
            setSelectedPath(search.bleededImagePath);
            const loadedFiles = await loadFiles(search.bleededImagePath);
            setItems(loadedFiles.map(f => ({ ...f, type: 'Image', id: f.path }))); // Use path as ID for initial load
        }
        refresh();
    }, [search.bleededImagePath]);

    useEffect(() => {
        const unlisten = listen('merge-progress', (event: { payload: { current: number, total: number } }) => {
            setProgress(event.payload);
        });

        return () => {
            unlisten.then(u => u());
        };
    }, []);

    const handleFolderSelect = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected && typeof selected === 'string') {
                setSelectedPath(selected);
                const loadedFiles = await loadFiles(selected);
                setItems(loadedFiles.map(f => ({ ...f, type: 'Image', id: f.path })));
            }
        } catch (err) {
            console.error("Dialog failed", err);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setItems((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleAddBlank = () => {
        const newId = crypto.randomUUID();
        setItems(prev => [...prev, { id: newId, type: 'Blank', path: 'BLANK_PAGE', name: '白紙' }]);
    };

    const handleDelete = (id: string) => {
        setItems(prev => prev.filter(item => item.id !== id));
    };

    const handleExecute = async () => {
        setIsProcessing(true);
        setProgress({ current: 0, total: items.length });

        try {
            // Transform items for backend
            const backendItems = items.map(item =>
                item.type === 'Blank' ? { type: 'Blank' } : { type: 'Image', path: item.path }
            );

            const _ = await invoke<string>('merge_to_pdf', {
                items: backendItems,
                outputDir: selectedPath
            });

            // Send notification
            const notifyCompletion = async () => {
                let permission = await isPermissionGranted();
                if (!permission) {
                    const permissionResponse = await requestPermission();
                    permission = permissionResponse === 'granted';
                }
                if (permission) {
                    sendNotification({ title: 'Comicker', body: 'PDFの統合処理が完了しました！' });
                }
            };
            notifyCompletion();
        } catch (err) {
            console.error("Merge failed", err);
        } finally {
            setIsProcessing(false);
        }
    };

    // Mock processing loop
    // let current = 0;
    // const interval = setInterval(() => {
    //     current++;

    //     if (current >= 10) {
    //         clearInterval(interval);
    //         setIsProcessing(false);

    //         // Scroll to Preview Mode
    //         const previewSection = document.getElementById('preview-section');
    //         if (previewSection) {
    //             previewSection.scrollIntoView({ behavior: 'smooth' });
    //         }

    //         // Send notification
    //         const notifyCompletion = async () => {
    //             let permission = await isPermissionGranted();
    //             if (!permission) {
    //                 const permissionResponse = await requestPermission();
    //                 permission = permissionResponse === 'granted';
    //             }
    //             if (permission) {
    //                 sendNotification({ title: 'Comicker', body: 'PDFの統合処理が完了しました！' });
    //             }
    //         };
    //         notifyCompletion();
    //     }
    // }, 300);
    return (
        <div className="h-full w-full grid grid-cols-[1fr_400px] bg-gray-50 dark:bg-[#1e1e1e] text-gray-900 dark:text-white transition-colors duration-200">
            {/* Left Side: Preview & Progress */}
            <div className="h-full border-r border-gray-200 dark:border-[#3a3a3a] flex flex-col p-6 gap-4 overflow-y-hidden">

                <div className="flex-1 bg-gray-200 dark:bg-[#2a2a2a] rounded-xl overflow-hidden relative border border-gray-300 dark:border-[#3a3a3a] transition-colors">
                    {!selectedPath ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm p-6 text-center">
                            <FolderOpen size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
                            <p className="text-gray-600 dark:text-white text-lg font-medium">フォルダを選択してください</p>
                        </div>
                    ) : (
                        // Content preview (simplified for now)
                        <div className="h-full p-4 overflow-y-auto custom-scrollbar">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={items.map(i => i.id)}
                                    strategy={rectSortingStrategy}
                                >
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4 pb-16">
                                        {items.map((item, idx) => (
                                            <Thumbnail
                                                key={item.id}
                                                id={item.id}
                                                file={item}
                                                index={idx}
                                                onDelete={() => handleDelete(item.id)}
                                            />
                                        ))}

                                        {/* Add Blank Page Button */}
                                        <button
                                            onClick={handleAddBlank}
                                            className="aspect-square rounded-lg border-2 border-dashed border-gray-400 dark:border-gray-600 hover:border-main hover:bg-gray-100 dark:hover:bg-[#333333] flex flex-col items-center justify-center gap-2 transition-all group"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center group-hover:bg-main group-hover:text-white transition-colors">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 group-hover:text-white">白紙を追加</span>
                                        </button>
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    )}
                </div>

                {/* Folder Selection Button */}
                <button
                    onClick={handleFolderSelect}
                    disabled={isProcessing}
                    className={clsx(
                        "w-full py-4 rounded-xl font-bold transition-all duration-200 shadow-lg active:scale-[0.98]",
                        "bg-main text-white hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center justify-center text-center leading-tight min-h-[80px]"
                    )}
                >
                    {selectedPath ? (
                        <span className="text-sm">
                            <span className="opacity-90 block mb-1">フォルダ選択中</span>
                            <span className="font-mono bg-white/20 dark:bg-black/20 px-2 py-1 rounded mx-2 block truncate max-w-[300px]">
                                {selectedPath}
                            </span>
                        </span>
                    ) : (
                        <span className="text-lg">フォルダを選択してください</span>
                    )}
                </button>
            </div>

            {/* Right Side: Settings */}
            <div className="h-full p-8 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div>
                    <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Merge Settings</h2>
                        <p className="text-gray-500 dark:text-gray-400">PDF統合設定</p>
                    </div>

                    <div className="space-y-8">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            左のプレビュー画面でページの並び替えや削除、白紙ページの追加が可能です。
                        </p>
                    </div>
                </div>

                {/* Execute Button */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <button
                        onClick={handleExecute}
                        disabled={!selectedPath || isProcessing}
                        className={clsx(
                            "w-full py-5 rounded-xl font-bold text-lg shadow-xl transition-all duration-200 flex items-center justify-center gap-3",
                            selectedPath && !isProcessing
                                ? "bg-main text-white hover:brightness-110 hover:-translate-y-1 active:translate-y-0 active:scale-[0.99]"
                                : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                        )}
                    >
                        {isProcessing ? (
                            <>
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>
                                    {`処理中... (${progress.current}/${progress.total})`}
                                </span>
                            </>
                        ) : (
                            <>
                                <span>PDF統合を実行</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
