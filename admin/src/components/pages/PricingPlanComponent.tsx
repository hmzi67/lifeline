import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calendar, ToggleLeft, ToggleRight, Star, Hash, Plus, BarChart2 } from 'lucide-react';
import { CrudTable, type Column } from '@/components/shared/CrudTable';
import { FormModal, type FormField } from '@/components/shared/FormModal';
import { CrudService, handleApiError } from '@/services/crudService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PricingPlan {
    id: string;
    name: string;
    description: string | null;
    price: number;
    originalPrice: number | null;
    durationMonths: number;
    trialDays: number;
    appleProductId: string | null;
    features: string[];
    isActive: boolean;
    isHighlighted: boolean;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const pricingPlanService = new CrudService<PricingPlan>('/pricing-plans');

// ─── Component ────────────────────────────────────────────────────────────────

const PricingPlanComponent: React.FC = () => {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<PricingPlan | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await pricingPlanService.customGet<PricingPlan[]>('/admin');
            if (response.success && Array.isArray(response.data)) {
                setPlans(response.data);
            }
        } catch (err: any) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingPlan(null);
        setIsModalOpen(true);
    };

    const handleEdit = (plan: PricingPlan) => {
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    const handleDelete = async (plan: PricingPlan) => {
        if (!window.confirm(`Archive plan "${plan.name}"? It will no longer be available for new purchases.`)) return;
        try {
            await pricingPlanService.delete(plan.id);
            fetchPlans();
        } catch (err: any) {
            setError(handleApiError(err));
        }
    };

    const handleToggleActive = async (plan: PricingPlan) => {
        try {
            await pricingPlanService.update(plan.id, { isActive: !plan.isActive });
            fetchPlans();
        } catch (err: any) {
            setError(handleApiError(err));
        }
    };

    const handleSubmit = async (data: Record<string, any>) => {
        const features = String(data.features || '')
            .split('\n')
            .map((f: string) => f.trim())
            .filter(Boolean);

        const payload = {
            name: String(data.name || ''),
            description: data.description || null,
            price: Number(data.price) || 0,
            originalPrice: data.originalPrice ? Number(data.originalPrice) : null,
            durationMonths: Number(data.durationMonths) || 1,
            trialDays: Number(data.trialDays) || 0,
            appleProductId: String(data.appleProductId || '').trim() || null,
            features,
            isActive: data.isActive !== 'false',
            isHighlighted: data.isHighlighted === 'true',
            sortOrder: Number(data.sortOrder) || 0,
        };

        if (editingPlan) {
            await pricingPlanService.update(editingPlan.id, payload);
        } else {
            await pricingPlanService.create(payload);
        }
        fetchPlans();
    };

    const formatCurrency = (amount: number) => `$${Number(amount).toFixed(2)}`;

    const formatDuration = (months: number) => {
        if (months === 1) return '1 month';
        if (months < 12) return `${months} months`;
        if (months === 12) return '1 year';
        return `${months / 12} years`;
    };

    // ─── Table Columns ────────────────────────────────────────────────────────

    const columns: Column<PricingPlan>[] = [
        {
            key: 'name',
            label: 'Plan',
            render: (value, row) => (
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        row.isHighlighted
                            ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                            : 'bg-gradient-to-br from-blue-400 to-indigo-500'
                    }`}>
                        {row.isHighlighted ? <Star className="w-5 h-5 text-white" /> : <CreditCard className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{value}</div>
                        {row.description && (
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{row.description}</div>
                        )}
                    </div>
                </div>
            ),
        },
        {
            key: 'price',
            label: 'Price',
            render: (value, row) => (
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-900">{formatCurrency(Number(value))}</span>
                    {row.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">{formatCurrency(Number(row.originalPrice))}</span>
                    )}
                </div>
            ),
        },
        {
            key: 'durationMonths',
            label: 'Duration',
            render: (value) => (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {formatDuration(value)}
                </div>
            ),
        },
        {
            key: 'trialDays',
            label: 'Trial',
            render: (value) => (
                <span className="text-sm text-gray-600">
                    {value > 0 ? `${value} days` : 'No trial'}
                </span>
            ),
        },
        {
            key: 'appleProductId',
            label: 'App Store',
            render: (value) => (
                <span className={`text-xs ${value ? 'text-gray-700 font-mono' : 'text-gray-400'}`}>
                    {value || 'Not on iOS'}
                </span>
            ),
        },
        {
            key: 'features',
            label: 'Features',
            render: (value) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {value?.length || 0} features
                </span>
            ),
        },
        {
            key: 'isActive',
            label: 'Status',
            render: (value, row) => (
                <button
                    type="button"
                    onClick={() => handleToggleActive(row)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        value
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                >
                    {value ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {value ? 'Active' : 'Inactive'}
                </button>
            ),
        },
        {
            key: 'isHighlighted',
            label: 'Featured',
            render: (value) => (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    value ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                }`}>
                    <Star className="w-3 h-3" />
                    {value ? 'Featured' : '—'}
                </span>
            ),
        },
        {
            key: 'sortOrder',
            label: 'Order',
            render: (value) => (
                <span className="flex items-center gap-1 text-sm text-gray-500">
                    <Hash className="w-3.5 h-3.5" />
                    {value}
                </span>
            ),
        },
    ];

    // ─── Form Fields ─────────────────────────────────────────────────────────

    const formFields: FormField[] = [
        {
            name: 'name',
            label: 'Plan Name',
            type: 'text',
            required: true,
            placeholder: 'e.g. Premium Monthly',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'text',
            required: false,
            placeholder: 'Short description of the plan',
        },
        {
            name: 'price',
            label: 'Price ($)',
            type: 'number',
            required: true,
            placeholder: '9.99',
            hint: 'Charged once by card (Android and web) for the whole duration; at least $0.50. iPhone buyers pay the App Store price set in App Store Connect.',
        },
        {
            name: 'originalPrice',
            label: 'Original Price ($, optional)',
            type: 'number',
            required: false,
            placeholder: '19.99',
            hint: 'Shown struck through next to the price, so it must be higher.',
        },
        {
            name: 'durationMonths',
            label: 'Duration (months)',
            type: 'number',
            required: true,
            placeholder: '1',
            hint: 'Access length for a card purchase. For iPhone, match the App Store product’s period.',
        },
        {
            name: 'trialDays',
            label: 'Free Trial (days)',
            type: 'number',
            required: false,
            placeholder: '0',
            hint: 'Card payments only: the card is saved and charged when the trial ends. iPhone trials are set as an introductory offer in App Store Connect.',
        },
        {
            name: 'appleProductId',
            label: 'App Store Product ID (iOS)',
            type: 'text',
            required: false,
            placeholder: 'com.irtaza.lifeline.vip.monthly',
            hint: 'Must match an auto-renewable subscription in App Store Connect exactly. Plans without it are hidden on iPhone. It cannot change once App Store subscribers exist.',
        },
        {
            name: 'features',
            label: 'Features (one per line)',
            type: 'textarea',
            required: false,
            placeholder: 'Feature 1\nFeature 2\nFeature 3',
        },
        {
            name: 'sortOrder',
            label: 'Sort Order',
            type: 'number',
            required: false,
            placeholder: '0',
        },
        {
            name: 'isHighlighted',
            label: 'Featured Plan',
            type: 'select',
            required: false,
            options: [
                { value: 'true', label: 'Yes (Featured)' },
                { value: 'false', label: 'No' },
            ],
        },
        {
            name: 'isActive',
            label: 'Status',
            type: 'select',
            required: false,
            options: [
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
            ],
        },
    ];

    // ─── Stats ────────────────────────────────────────────────────────────────

    const stats = [
        {
            label: 'Total Plans',
            value: plans.length,
            gradient: 'bg-gradient-to-br from-blue-100 to-indigo-100',
        },
        {
            label: 'Active Plans',
            value: plans.filter(p => p.isActive).length,
            gradient: 'bg-gradient-to-br from-green-100 to-emerald-100',
        },
        {
            label: 'Featured',
            value: plans.filter(p => p.isHighlighted).length,
            gradient: 'bg-gradient-to-br from-amber-100 to-orange-100',
        },
        {
            label: 'Price Range',
            value: plans.length > 0
                ? `${formatCurrency(Math.min(...plans.map(p => Number(p.price))))} – ${formatCurrency(Math.max(...plans.map(p => Number(p.price))))}`
                : '—',
            gradient: 'bg-gradient-to-br from-purple-100 to-pink-100',
        },
    ];

    return (
        <>
            <CrudTable
                data={plans}
                columns={columns}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleCreate}
                title="Pricing Plans"
                description="Manage subscription pricing plans and features"
                icon={CreditCard}
                searchPlaceholder="Search plans..."
                emptyMessage="No pricing plans found. Create one to get started."
                stats={stats}
            />

            <FormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                title={editingPlan ? `Edit Plan: ${editingPlan.name}` : 'Create New Plan'}
                fields={formFields}
                initialData={
                    editingPlan
                        ? {
                              name: editingPlan.name,
                              description: editingPlan.description || '',
                              price: editingPlan.price,
                              originalPrice: editingPlan.originalPrice ?? '',
                              durationMonths: editingPlan.durationMonths,
                              trialDays: editingPlan.trialDays,
                              appleProductId: editingPlan.appleProductId || '',
                              features: (editingPlan.features || []).join('\n'),
                              sortOrder: editingPlan.sortOrder,
                              isHighlighted: String(editingPlan.isHighlighted),
                              isActive: String(editingPlan.isActive),
                          }
                        : { durationMonths: 1, trialDays: 0, sortOrder: 0, isHighlighted: 'false', isActive: 'true' }
                }
                submitLabel={editingPlan ? 'Save Changes' : 'Create Plan'}
            />
        </>
    );
};

export default PricingPlanComponent;
