import { Link } from '@tanstack/react-router';
import { Scissors, FileDigit, Link2, Mail } from 'lucide-react';


export const Sidebar = () => {
    const navItems = [
        { label: 'トンボ裁ち切り', icon: Scissors, to: '/bleed', mode: 'bleed' },
        { label: 'PDF統合', icon: FileDigit, to: '/merge', mode: 'merge' },
    ];

    return (
        <div className="flex flex-col h-full bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-white px-6 py-8 transition-colors duration-200">
            {/* Title */}
            <h1 className="text-[32px] font-bold text-main leading-tight">Comicker</h1>

            {/* Subtitle */}
            <h2 className="text-[16px] text-gray-500 dark:text-gray-400 mt-1">同人誌製作補助ツール</h2>

            {/* Splitter */}
            <div className="h-[1px] bg-gray-200 dark:bg-gray-600 my-8 w-full" />

            {/* Navigation Buttons */}
            <div className="flex flex-col gap-2 mb-auto">
                {navItems.map((item) => (
                    <Link
                        key={item.mode}
                        to={item.to as any}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#333333]"
                        inactiveProps={{
                            className: "text-gray-600 dark:text-gray-300"
                        }}
                        activeProps={{
                            className: "bg-main text-white font-semibold hover:bg-main dark:hover:bg-main"
                        }}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>

            {/* contact link and email */}
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#333333] cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 w-fit">
                    <Link2 size={12} />
                    <a href="https://x.com/rorikoron__game" className='text-sm text-main'>Twitter</a>
                </div>
                <div className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#333333] cursor-pointer px-4 py-2 rounded-lg transition-all duration-200 w-fit">
                    <Mail size={12} />
                    <a href="mailto:rorikoron@gmail.com?subject=ComickerContact" className='text-sm text-main'>rorikoron@gmail.com</a>
                </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                <button
                    onClick={() => {
                        document.documentElement.classList.toggle('dark');
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333333] w-full transition-all"
                >
                    <div className="w-5 h-5 rounded-full border border-gray-400 dark:border-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-gray-400 dark:bg-transparent transition-colors" style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)' }}></div>
                    </div>
                    <span>ダークモード切替</span>
                </button>
            </div>
        </div>
    );
};
