import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { ConvertPaperType } from '../bindings';
import { loadFiles } from '../lib/fs';
import { Thumbnail } from '../components/Thumbnail';


export const BleedView = () => {
    const navigate = useNavigate();
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [files, setFiles] = useState<Array<{ name: string, path: string }>>([]);

    const handleFolderSelect = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });

            if (selected && typeof selected === 'string') {
                setSelectedPath(selected);
                setFiles(await loadFiles(selected));
            }
        } catch (err) {
            console.error("Dialog failed", err);
        }
    };

    const [bleedAmount, setBleedAmount] = useState<'3mm' | '5mm'>('3mm');
    const [bleedPaperSize, setBleedPaperSize] = useState<ConvertPaperType>('B5');
    const [outputDirName, setOutputDirName] = useState('裁ち切り済み');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);

    const handleExecute = async () => {
        if (!selectedPath) return;

        setIsProcessing(true);
        setProgress(null);

        let unlisten: UnlistenFn | null = null;

        try {
            unlisten = await listen<{ current: number, total: number }>('bleed-progress', (event) => {
                setProgress(event.payload);
            });

            const bleed_mm = bleedAmount === '5mm' ? 5 : 3;
            const processedFiles = await invoke<string[]>('batch_bleed_images', {
                inputDir: selectedPath,
                outputDirName: outputDirName,
                convertType: bleedPaperSize,
                bleedAmount: bleed_mm,
            });

            console.log(`Successfully processed ${processedFiles.length} files`);

            // Send notification
            let permission = await isPermissionGranted();
            if (!permission) {
                const permissionResponse = await requestPermission();
                permission = permissionResponse === 'granted';
            }
            if (permission) {
                sendNotification({ title: 'Comicker', body: '裁ち切り処理が完了しました！' });
            }

            // Navigate to Merge Mode
            const targetPath = await join(selectedPath, outputDirName);
            navigate({ to: '/merge', search: { bleededImagePath: targetPath } });
        } catch (err) {
            console.error("Batch bleed failed:", err);
            alert(`処理に失敗しました: ${err}`);
        } finally {
            setIsProcessing(false);
            if (unlisten) unlisten();
            setProgress(null);
        }
    };

    return (
        <div className="h-full w-full grid grid-cols-[1fr_400px] bg-gray-50 dark:bg-[#1e1e1e] text-gray-900 dark:text-white transition-colors duration-200">
            {/* Left Side: Preview & Folder Selection */}
            <div className="h-full border-r border-gray-200 dark:border-[#3a3a3a] flex flex-col p-6 gap-4 overflow-y-hidden">
                {/* Preview Area */}
                <div className="flex-1 bg-gray-200 dark:bg-[#2a2a2a] rounded-xl overflow-hidden relative border border-gray-300 dark:border-[#3a3a3a] transition-colors">
                    {!selectedPath ? (
                        // Empty State Overlay
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm p-6 text-center">
                            <FolderOpen size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
                            <p className="text-gray-600 dark:text-white text-md font-medium">対象となるフォルダを選択してください</p><p className="text-gray-500">(PNGのみ対応)</p>
                        </div>
                    ) : (
                        // File Grid
                        <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                                {files.map((file, idx) => (
                                    <Thumbnail key={file.path} id={file.path} file={file} index={idx} isDraggable={false} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Folder Selection Button */}
                <button
                    onClick={handleFolderSelect}
                    className={clsx(
                        "w-full py-4 rounded-xl font-bold transition-all duration-200 shadow-lg active:scale-[0.98]",
                        "bg-main text-white hover:brightness-110",
                        "flex items-center justify-center text-center leading-tight min-h-[80px]"
                    )}
                >
                    {selectedPath ? (
                        <span className="text-sm">
                            <span className="opacity-90 block mb-1">フォルダ選択中</span>
                            <span
                                className="font-mono bg-white/20 dark:bg-black/20 px-2 py-1 rounded mx-2 block truncate max-w-[300px]"
                                title={selectedPath}
                            >
                                {selectedPath}
                            </span>
                        </span>
                    ) : (
                        <span className="text-lg">フォルダを選択してください</span>
                    )}
                </button>
            </div>

            {/* Right Side: Settings & Execution */}
            <div className="h-full p-8 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                <div>
                    <div className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Bleed Settings</h2>
                        <p className="text-gray-500 dark:text-gray-400">トンボ裁ち切り設定</p>
                    </div>

                    <div className="space-y-8">
                        {/* Bleed Width Toggle */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">裁ち切り幅</label>
                            <div className="flex bg-gray-200 dark:bg-[#2a2a2a] p-1 rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
                                {(['3mm', '5mm'] as const).map((width) => (
                                    <button
                                        key={width}
                                        onClick={() => setBleedAmount(width)}
                                        className={clsx(
                                            "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                            bleedAmount === width
                                                ? "bg-main text-white shadow-md"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700"
                                        )}
                                    >
                                        {width}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Bleed Format Toggle */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">製本サイズ</label>
                            <div className="flex bg-gray-200 dark:bg-[#2a2a2a] p-1 rounded-lg border border-gray-300 dark:border-gray-700 transition-colors">
                                {(['B5', 'A5'] as ConvertPaperType[]).map((format) => (
                                    <button
                                        key={format}
                                        onClick={() => setBleedPaperSize(format)}
                                        className={clsx(
                                            "flex-1 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                            bleedPaperSize === format
                                                ? "bg-main text-white shadow-md"
                                                : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-300 dark:hover:bg-gray-700"
                                        )}
                                    >
                                        {format}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Output Folder Name */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">出力先フォルダ名</label>
                            <div className='flex items-center gap-2'>
                                <span className="text-gray-500 font-mono text-xs truncate max-w-[200px] shrink-0"
                                    title={selectedPath ?? 'None'}
                                >
                                    {selectedPath + '\\'}
                                </span>
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={outputDirName}
                                        onChange={(e) => setOutputDirName(e.target.value)}
                                        className="w-full bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white font-mono border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-main focus:ring-1 focus:ring-main transition-all"
                                        placeholder="フォルダ名"
                                    />
                                </div>
                            </div>
                            <div className='space-y-3'>
                                <div className='font-mono'>
                                    <p className="text-xs mb-1 text-gray-600 dark:text-gray-300">上書き保存する場合、出力先を空にしてください。</p>
                                    <p className='text-gray-500 dark:text-gray-400 text-xs'>選択したフォルダ内の画像を上書き保存する場合、何も入力しません。</p>
                                </div>
                                <div className='font-mono'>
                                    <p className="text-xs mb-1 text-gray-600 dark:text-gray-300">フォルダ名に\を含めると追加のフォルダを作成できます。</p>
                                    <p className='text-gray-500 dark:text-gray-400 text-xs'>「処理済\png」とすると、「処理済」というフォルダの中に「png」というフォルダが作成され、その中に画像が保存されます。</p>
                                </div>
                            </div>
                        </div>
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
                                    {progress
                                        ? `処理中... (${progress.current}/${progress.total})`
                                        : '処理中...'}
                                </span>
                            </>
                        ) : (
                            <>
                                <span>実行してマージへ進む</span>
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
