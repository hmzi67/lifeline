import React, { useState, useEffect, useMemo } from 'react';
import { Ticket, Calendar, Users, ToggleLeft, ToggleRight, Stethoscope } from 'lucide-react';
import { CrudTable, type Column } from '@/components/shared/CrudTable';
import { FormModal, type FormField } from '@/components/shared/FormModal';
import { CrudService, handleApiError } from '@/services/crudService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CouponCode {
    id: string;
    code: string;
    description: string | null;
    discountPercent: number;
    maxUses: number;
    maxUsesPerUser: number;
    currentUses: number;
    doctorId: string | null;
    doctor?: { id: string; name: string; clinic: string | null } | null;
    isActive: boolean;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; email: string; username: string | null } | null;
    _count?: { usages: number };
}

// ─── Service ──────────────────────────────────────────────────────────────────

interface DoctorOption {
    id: string;
    name: string;
    clinic: string | null;
    isActive: boolean;
}

const couponService = new CrudService<CouponCode>('/coupons');
const doctorService = new CrudService<DoctorOption>('/doctors');

/** yyyy-mm-dd, `days` from today in local time. */
const daysFromToday = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toDateInput(d.toISOString());
};

/** The picked date's last second, local time: the coupon still works on that day. */
const endOfDay = (date: string) => new Date(`${date}T23:59:59.999`).toISOString();

/** yyyy-mm-dd in local time, for the date input. */
const toDateInput = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isExpired = (coupon: CouponCode) => !!coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
const isUsedUp = (coupon: CouponCode) => coupon.currentUses >= coupon.maxUses;

// ─── Component ────────────────────────────────────────────────────────────────

const CouponComponent: React.FC = () => {
    const [coupons, setCoupons] = useState<CouponCode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCoupon, setEditingCoupon] = useState<CouponCode | null>(null);
    const [doctors, setDoctors] = useState<DoctorOption[]>([]);

    useEffect(() => {
        fetchCoupons();
        doctorService
            .getAll()
            .then((response) => {
                if (response.success && Array.isArray(response.data)) setDoctors(response.data);
            })
            .catch((err) => setError(handleApiError(err)));
    }, []);

    const fetchCoupons = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await couponService.getAll({ limit: 100 });
            if (response.success && Array.isArray(response.data)) {
                setCoupons(response.data);
            }
        } catch (err: any) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingCoupon(null);
        setIsModalOpen(true);
    };

    const handleEdit = (coupon: CouponCode) => {
        setEditingCoupon(coupon);
        setIsModalOpen(true);
    };

    const handleDelete = async (coupon: CouponCode) => {
        if (!window.confirm(`Delete coupon "${coupon.code}"? This cannot be undone.`)) return;
        try {
            await couponService.delete(coupon.id);
            fetchCoupons();
        } catch (err: any) {
            setError(handleApiError(err));
        }
    };

    const handleToggleActive = async (coupon: CouponCode) => {
        try {
            await couponService.update(coupon.id, { isActive: !coupon.isActive });
            fetchCoupons();
        } catch (err: any) {
            setError(handleApiError(err));
        }
    };

    const handleSubmit = async (data: Record<string, any>) => {
        // New coupons take "valid for N days"; an existing one shows and edits its end date.
        const lastDay = editingCoupon
            ? data.expiresAt
            : Number(data.validDays) > 0
              ? daysFromToday(Number(data.validDays))
              : '';
        const payload = {
            description: data.description || undefined,
            discountPercent: Number(data.discountPercent) || 10,
            maxUses: Number(data.maxUses),
            maxUsesPerUser: Number(data.maxUsesPerUser) || 1,
            isActive: data.isActive !== 'false',
            expiresAt: lastDay ? endOfDay(lastDay) : null,
            doctorId: data.doctorId || null,
        };

        try {
            if (editingCoupon) {
                await couponService.update(editingCoupon.id, payload); // the code itself cannot change
            } else {
                await couponService.create({ ...payload, code: String(data.code || '').toUpperCase() });
            }
        } catch (err: any) {
            // Show the server's reason (e.g. "A coupon with this code already exists"), not "status code 409".
            throw new Error(handleApiError(err));
        }
        fetchCoupons();
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    };

    // ─── Table Columns ────────────────────────────────────────────────────────

    const columns: Column<CouponCode>[] = [
        {
            key: 'code',
            label: 'Code',
            render: (value) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Ticket className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-mono font-semibold text-gray-900 tracking-widest">{value}</span>
                </div>
            ),
        },
        {
            key: 'doctor',
            label: 'Doctor',
            render: (_value, row) =>
                row.doctor ? (
                    <div className="text-sm">
                        <div className="flex items-center gap-1 font-medium text-gray-900">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-500" />
                            {row.doctor.name}
                        </div>
                        {row.doctor.clinic && <div className="text-xs text-gray-500">{row.doctor.clinic}</div>}
                    </div>
                ) : (
                    <span className="text-sm text-gray-400">—</span>
                ),
        },
        {
            key: 'discountPercent',
            label: 'Discount',
            render: (value) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                    {value}% OFF
                </span>
            ),
        },
        {
            key: 'currentUses',
            label: 'Usage',
            render: (value, row) => {
                const pct = Math.round((value / row.maxUses) * 100);
                const left = Math.max(row.maxUses - value, 0);
                const barColor = pct >= 100 ? 'bg-red-400' : pct >= 75 ? 'bg-orange-400' : 'bg-emerald-400';
                return (
                    <div className="w-32">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{value} / {row.maxUses}</span>
                            <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {left === 0 ? 'None left' : `${left} left`} · {row.maxUsesPerUser === 1 ? '1 per user' : `${row.maxUsesPerUser} per user`}
                        </div>
                    </div>
                );
            },
        },
        {
            key: 'isActive',
            label: 'Status',
            render: (value, row) => (
                <div className="flex flex-col items-start gap-1">
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
                {value && (isExpired(row) || isUsedUp(row)) && (
                    <span className="text-xs font-medium text-red-600">{isExpired(row) ? 'Expired' : 'Used up'}</span>
                )}
                </div>
            ),
        },
        {
            key: 'expiresAt',
            label: 'Expires',
            render: (value) => (
                <div className="flex items-center gap-1 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    {formatDate(value)}
                </div>
            ),
        },
        {
            key: 'createdAt',
            label: 'Created',
            render: (value) => (
                <span className="text-sm text-gray-500">{formatDate(value)}</span>
            ),
        },
    ];

    // ─── Form Fields ─────────────────────────────────────────────────────────

    const doctorOptions = useMemo(
        () => [
            { value: '', label: 'No doctor' },
            ...doctors
                .filter((d) => d.isActive || d.id === editingCoupon?.doctorId)
                .map((d) => ({ value: d.id, label: d.clinic ? `${d.name} (${d.clinic})` : d.name })),
        ],
        [doctors, editingCoupon],
    );

    const formFields = useMemo<FormField[]>(() => [
        {
            name: 'code',
            label: 'Coupon Code',
            type: 'text',
            required: true,
            placeholder: 'e.g. DOCTOR10',
            disabled: !!editingCoupon,
            hint: editingCoupon ? 'The code cannot be changed after it is created.' : undefined,
        },
        {
            name: 'doctorId',
            label: 'Doctor',
            type: 'select',
            required: false,
            options: doctorOptions,
            hint: doctors.length ? 'The doctor who gives this code to patients.' : 'Add doctors on the Doctors page first.',
        },
        {
            name: 'description',
            label: 'Description',
            type: 'text',
            required: false,
            placeholder: 'e.g. Dr. Ahmed - clinic patients',
        },
        {
            name: 'discountPercent',
            label: 'Discount (%)',
            type: 'number',
            required: true,
            placeholder: '50',
            min: 1,
            max: 100,
            hint: 'e.g. 50 makes a $20 plan $10.',
        },
        {
            name: 'maxUses',
            label: 'Total Uses (number of coupons)',
            type: 'number',
            required: true,
            placeholder: '10',
            min: 1,
            hint: 'How many times this coupon can be used in total, e.g. 10 for a doctor.',
        },
        {
            name: 'maxUsesPerUser',
            label: 'Uses per User',
            type: 'number',
            required: true,
            placeholder: '1',
            min: 1,
            max: 100,
            hint: 'How many times one user can use this coupon. Usually 1.',
        },
        editingCoupon
            ? {
                  name: 'expiresAt',
                  label: 'Expiry Date (optional)',
                  type: 'date',
                  required: false,
                  hint: 'Last day the coupon works. Leave empty for no expiry.',
              }
            : {
                  name: 'validDays',
                  label: 'Valid for (days)',
                  type: 'number',
                  required: false,
                  placeholder: '15',
                  min: 1,
                  hint: 'e.g. 15 or 20. The coupon works until the end of that day. Leave empty for no expiry.',
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
    ], [editingCoupon, doctorOptions, doctors.length]);

    // Memoized: the form resets whenever these change, so they must not be rebuilt on every render.
    const initialData = useMemo(
        () =>
            editingCoupon
                ? {
                      code: editingCoupon.code,
                      doctorId: editingCoupon.doctorId || '',
                      description: editingCoupon.description || '',
                      discountPercent: editingCoupon.discountPercent,
                      maxUses: editingCoupon.maxUses,
                      maxUsesPerUser: editingCoupon.maxUsesPerUser,
                      expiresAt: editingCoupon.expiresAt ? toDateInput(editingCoupon.expiresAt) : '',
                      isActive: String(editingCoupon.isActive),
                  }
                : { discountPercent: 10, maxUsesPerUser: 1, doctorId: '', isActive: 'true' },
        [editingCoupon],
    );

    // ─── Stats ────────────────────────────────────────────────────────────────

    const stats = [
        {
            label: 'Total Coupons',
            value: coupons.length,
            gradient: 'bg-gradient-to-br from-violet-100 to-purple-100',
        },
        {
            label: 'Active Coupons',
            value: coupons.filter((c) => c.isActive && !isExpired(c) && !isUsedUp(c)).length,
            gradient: 'bg-gradient-to-br from-green-100 to-emerald-100',
        },
        {
            label: 'Total Uses',
            value: coupons.reduce((sum, c) => sum + c.currentUses, 0),
            gradient: 'bg-gradient-to-br from-blue-100 to-cyan-100',
        },
        {
            label: 'Expired / Used up / Inactive',
            value: coupons.filter((c) => !c.isActive || isExpired(c) || isUsedUp(c)).length,
            gradient: 'bg-gradient-to-br from-gray-100 to-slate-100',
        },
    ];

    return (
        <>
            <CrudTable
                data={coupons}
                columns={columns}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleCreate}
                title="Coupon Codes"
                description="Create discount coupons for doctors and promoters, with a usage limit and expiry date"
                icon={Ticket}
                searchPlaceholder="Search coupons..."
                emptyMessage="No coupons found. Create one to get started."
                stats={stats}
            />

            <FormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                title={editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
                fields={formFields}
                initialData={initialData}
                submitLabel={editingCoupon ? 'Save Changes' : 'Create Coupon'}
            />
        </>
    );
};

export default CouponComponent;
