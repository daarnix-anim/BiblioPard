import React from 'react';
import { Layers, Box, Sun, Film, Type, Tag, Palette } from 'lucide-react';
import { Category, AssetItem } from '../types';

interface SidebarCategoriesProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  assets: AssetItem[];
}

export const SidebarCategories: React.FC<SidebarCategoriesProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedTag,
  onSelectTag,
  assets
}) => {
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Box': return <Box className="w-4 h-4" />;
      case 'Palette': return <Palette className="w-4 h-4" />;
      case 'Sun': return <Sun className="w-4 h-4" />;
      case 'Film': return <Film className="w-4 h-4" />;
      case 'Type': return <Type className="w-4 h-4" />;
      default: return <Layers className="w-4 h-4" />;
    }
  };

  // Compute counts per category
  const getCategoryCount = (category: Category) => {
    if (category.type === 'all') return assets.length;
    return assets.filter(a => a.type === category.type).length;
  };

  // Collect unique tags
  const allTags = Array.from(
    new Set(assets.flatMap(a => a.tags || []))
  ).slice(0, 12);

  return (
    <aside className="w-48 bg-[#1a1a1a] border-r border-[#2d2d2d] flex flex-col shrink-0 p-2.5 overflow-y-auto">
      <div className="mb-2">
        <span className="text-[10px] font-semibold tracking-wider text-[#666666] uppercase px-2">
          Категории
        </span>
      </div>

      <nav className="space-y-1">
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id && !selectedTag;
          const count = getCategoryCount(cat);

          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                onSelectTag(null);
              }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-adobe-accent text-white shadow-sm'
                  : 'text-[#a3a3a3] hover:text-white hover:bg-[#252525]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={isSelected ? 'text-white' : 'text-[#808080]'}>
                  {getIcon(cat.icon)}
                </span>
                <span>{cat.name}</span>
              </div>
              <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                isSelected ? 'bg-white/20 text-white' : 'bg-[#282828] text-[#737373]'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Popular Tags */}
      {allTags.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#2d2d2d]">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-semibold tracking-wider text-[#666666] uppercase flex items-center gap-1">
              <Tag className="w-3 h-3" /> Теги
            </span>
            {selectedTag && (
              <button
                onClick={() => onSelectTag(null)}
                className="text-[10px] text-adobe-accent hover:underline"
              >
                Сбросить
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 px-1">
            {allTags.map((tag) => {
              const isTagSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => onSelectTag(isTagSelected ? null : tag)}
                  className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                    isTagSelected
                      ? 'bg-adobe-teal text-black font-semibold'
                      : 'bg-[#252525] text-[#999999] hover:bg-[#333333] hover:text-white'
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
