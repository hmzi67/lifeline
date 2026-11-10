import React, { useState, useEffect, useRef } from 'react';
import GoNext from "@/components/common/GoNext.tsx";
import menimg from "@/assets/images/question/men_graph.webp";
import womenimg from "@/assets/images/question/women_graph.png";
import api from '@/lib/axios';

interface FocusAreaSelectorProps {
    gender: string;
    onSelectionChange?: (selectedAreas: string[]) => void;
    onContinue?: (selectedAreas: string[]) => void;
    onBack?: () => void;
}

// Anchor points on the figure, expressed as PERCENTAGES of the image's
// own width/height. This means they stay correctly positioned no matter
// how the image is scaled (mobile vs desktop), because they're relative
// to the image box itself, not the page.
const LEFT_ANCHORS: Record<string, { x: number; y: number }> = {
    Shoulders: { x: 30, y: 18 },
    Chest: { x: 38, y: 28 },
    Arms: { x: 22, y: 38 },
    Thighs: { x: 32, y: 58 },
    // 'Full Body' intentionally has no anchor, so no connector line is drawn for it
};

const RIGHT_ANCHORS: Record<string, { x: number; y: number }> = {
    Belly: { x: 62, y: 42 },
    Back: { x: 70, y: 42 },
    Legs: { x: 68, y: 68 },
};

export const FocusAreaSelector: React.FC<FocusAreaSelectorProps> = ({ gender, onSelectionChange, onContinue }) => {
    const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);

    // Refs used to measure element positions so we can draw SVG lines
    // between each label button and its anchor point on the image.
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const leftBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const rightBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const [lines, setLines] = useState<
        { key: string; x1: number; y1: number; x2: number; y2: number; dotX: number; dotY: number }[]
    >([]);

    // Fetch saved focus areas on mount
    useEffect(() => {
        const fetchFocusAreas = async () => {
            setLoading(true);
            try {
                const res = await api.get('/questionnaire/body-focus');
                const data = res?.data?.data?.bodyFocusArea;

                // Normalize data: can be array or string
                let areas: string[] = [];
                if (Array.isArray(data)) {
                    areas = data;
                } else if (typeof data === 'string') {
                    areas = data.trim() === '' ? [] : data.split(',').map((a: string) => a.trim());
                }

                setSelectedAreas(areas);
                onSelectionChange?.(areas);
            } catch {
                // Optional error handling
            } finally {
                setLoading(false);
            }
        };

        fetchFocusAreas();
    }, [onSelectionChange]);

    // Update focus areas in backend with debounce logic to reduce rapid calls
    // For simplicity, save immediately here on toggle; debounce can be added as needed
    const saveFocusAreas = async (areas: string[]) => {
        setSaving(true);
        try {
            await api.put('/questionnaire/body-focus-area', { bodyFocusArea: areas });
        } catch {
            // Optional error handling
        } finally {
            setSaving(false);
        }
    };

    // Toggle selection logic with "Full Body" rules
    const toggleArea = (area: string) => {
        let newSelection: string[];

        if (area === 'Full Body') {
            newSelection = selectedAreas.includes('Full Body') ? [] : ['Full Body'];
        } else {
            const withoutFullBody = selectedAreas.filter(a => a !== 'Full Body');

            if (withoutFullBody.includes(area)) {
                newSelection = withoutFullBody.filter(a => a !== area);
            } else {
                newSelection = [...withoutFullBody, area];
            }
        }

        setSelectedAreas(newSelection);
        onSelectionChange?.(newSelection);
        saveFocusAreas(newSelection);
    };

    const isSelected = (area: string) => selectedAreas.includes(area);

    const handleContinue = () => {
        onContinue?.(selectedAreas);
    };

    // Recalculate connector line coordinates whenever layout could have
    // changed: on mount, on resize, and whenever the image finishes loading.
    useEffect(() => {
        const computeLines = () => {
            const container = containerRef.current;
            const image = imageRef.current;
            if (!container || !image) return;

            const containerBox = container.getBoundingClientRect();
            const imageBox = image.getBoundingClientRect();

            const newLines: typeof lines = [];

            const addLine = (
                key: string,
                btn: HTMLButtonElement | null,
                anchor: { x: number; y: number },
                side: 'left' | 'right'
            ) => {
                if (!btn) return;
                const btnBox = btn.getBoundingClientRect();

                // Line starts at the edge of the button closest to the image
                const startX =
                    side === 'left'
                        ? btnBox.right - containerBox.left
                        : btnBox.left - containerBox.left;
                const startY = btnBox.top + btnBox.height / 2 - containerBox.top;

                // Anchor point on the image, converted from % to px relative
                // to the container
                const endX = imageBox.left - containerBox.left + (anchor.x / 100) * imageBox.width;
                const endY = imageBox.top - containerBox.top + (anchor.y / 100) * imageBox.height;

                newLines.push({ key, x1: startX, y1: startY, x2: endX, y2: endY, dotX: endX, dotY: endY });
            };

            Object.entries(LEFT_ANCHORS).forEach(([area, anchor]) =>
                addLine(area, leftBtnRefs.current[area], anchor, 'left')
            );
            Object.entries(RIGHT_ANCHORS).forEach(([area, anchor]) =>
                addLine(area, rightBtnRefs.current[area], anchor, 'right')
            );

            setLines(newLines);
        };

        computeLines();

        const resizeObserver = new ResizeObserver(computeLines);
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        window.addEventListener('resize', computeLines);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', computeLines);
        };
    }, [gender, selectedAreas.length]);

    const renderButton = (
        area: string,
        side: 'left' | 'right'
    ) => (
        <button
            key={area}
            ref={(el) => {
                if (side === 'left') leftBtnRefs.current[area] = el;
                else rightBtnRefs.current[area] = el;
            }}
            type="button"
            onClick={() => toggleArea(area)}
            disabled={loading || saving}
            className={`relative z-10 px-3 sm:px-6 py-2 rounded-lg border-2 transition duration-200 text-center text-sm sm:text-lg font-semibold
        ${isSelected(area)
                    ? 'bg-primary text-white border-primary shadow-lg'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-primary hover:text-white hover:border-primary cursor-pointer'}
      `}
        >
            {area}
        </button>
    );

    return (
        <div className="flex items-center justify-center py-10 px-4">
            <div className="w-full max-w-7xl">
                {/* Header */}
                <div className="text-center mb-8 sm:mb-12">
                    <h1 className="text-3xl sm:text-5xl font-bold text-gray-900 mb-4">
                       Choose your focus area
                    </h1>
                    <p className="text-lg text-gray-600">
                        Tell us which part of your body you'd like to focus on during your workouts
                    </p>
                </div>

                {/* Content */}
                <div ref={containerRef} className="relative flex flex-col sm:flex-row items-center justify-center">

                    {/* SVG overlay for connector lines, sits above everything within this container */}
                    <svg
                        className="pointer-events-none absolute inset-0 w-full h-full z-20 hidden sm:block"
                    >
                        {lines.map(line => (
                            <g key={line.key}>
                                <line
                                    x1={line.x1}
                                    y1={line.y1}
                                    x2={line.x2}
                                    y2={line.y2}
                                    stroke={isSelected(line.key) ? '#0d9488' : '#5eead4'}
                                    strokeWidth={2}
                                />
                                <circle cx={line.dotX} cy={line.dotY} r={4} fill={isSelected(line.key) ? '#0d9488' : '#5eead4'} />
                            </g>
                        ))}
                    </svg>

                    {/* Left side */}
                    <div className="relative z-10 flex flex-col space-y-4 sm:space-y-8 max-w-xs">
                        {['Shoulders', 'Chest', 'Arms', 'Thighs', 'Full Body'].map(area => renderButton(area, 'left'))}
                    </div>

                    {/* Middle figure */}
                    <div className="relative mx-8 my-6 sm:my-0 flex-shrink-0">
                        <img
                            ref={imageRef}
                            src={gender === 'female' ? womenimg : menimg}
                            alt={`${gender === 'female' ? 'Female' : 'Male'} figure`}
                            className="w-48"
                            onLoad={() => {
                                // Trigger a recompute once the image has real dimensions
                                window.dispatchEvent(new Event('resize'));
                            }}
                        />
                    </div>

                    {/* Right side */}
                    <div className="relative z-10 flex flex-col space-y-4 sm:space-y-8 max-w-xs">
                        {['Belly', 'Back', 'Legs'].map(area => renderButton(area, 'right'))}
                    </div>
                </div>

                {/* Selected list for confirmation */}
                {selectedAreas.length > 0 && (
                    <div className="mt-10 text-center">
                        <h3 className="text-lg font-medium mb-3">Selected Areas:</h3>
                        <div className="flex flex-wrap justify-center gap-3">
                            {selectedAreas.map(area => (
                                <span key={area} className="bg-teal-100 text-primary-700 px-3 py-1 rounded-full text-sm">
                                    {area}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-center gap-6 mt-12">
                    <GoNext onClick={handleContinue} loading={loading || saving} />
                </div>
            </div>
        </div>
    );
};

export default FocusAreaSelector;