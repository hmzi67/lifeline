import React, { useEffect, useMemo, useState } from 'react';
import { Stethoscope, Phone, Ticket } from 'lucide-react';
import { CrudTable, type Column } from '@/components/shared/CrudTable';
import { FormModal, type FormField } from '@/components/shared/FormModal';
import { CrudService, handleApiError } from '@/services/crudService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DoctorStats {
    coupons: number;
    activeCoupons: number;
    totalUses: number;
    usedUses: number;
    usesLeft: number;
}

interface Doctor {
    id: string;
    name: string;
    clinic: string | null;
    phone: string | null;
    email: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: string;
    coupons: { id: string; code: string }[];
    stats?: DoctorStats;
}

const doctorService = new CrudService<Doctor>('/doctors');

// ─── Component ────────────────────────────────────────────────────────────────

/** Doctors who hand coupon codes to their patients, with each doctor's coupon totals. */
const DoctorComponent: React.FC = () => {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);

    const fetchDoctors = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await doctorService.getAll();
            if (response.success && Array.isArray(response.data)) setDoctors(response.data);
        } catch (err) {
            setError(handleApiError(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const handleDelete = async (doctor: Doctor) => {
        if (!window.confirm(`Delete doctor "${doctor.name}"?`)) return;
        try {
            await doctorService.delete(doctor.id);
            fetchDoctors();
        } catch (err) {
            setError(handleApiError(err));
        }
    };

    const handleSubmit = async (data: Record<string, unknown>) => {
        const optional = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
        const payload = {
            name: String(data.name || '').trim(),
            clinic: optional(data.clinic),
            phone: optional(data.phone),
            email: optional(data.email),
            notes: optional(data.notes),
            isActive: data.isActive !== 'false',
        };
        try {
            if (editingDoctor) await doctorService.update(editingDoctor.id, payload);
            else await doctorService.create(payload);
        } catch (err) {
            throw new Error(handleApiError(err));
        }
        fetchDoctors();
    };

    const columns: Column<Doctor>[] = [
        {
            key: 'name',
            label: 'Doctor',
            render: (value, row) => (
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <div className="font-semibold text-gray-900">{value}</div>
                        {row.clinic && <div className="text-xs text-gray-500">{row.clinic}</div>}
                    </div>
                </div>
            ),
        },
        {
            key: 'phone',
            label: 'Contact',
            render: (_value, row) => (
                <div className="text-sm text-gray-600">
                    {row.phone && (
                        <div className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5" />
                            {row.phone}
                        </div>
                    )}
                    {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
                    {!row.phone && !row.email && <span className="text-gray-400">—</span>}
                </div>
            ),
        },
        {
            key: 'coupons',
            label: 'Coupons',
            render: (_value, row) => (
                <div className="text-sm">
                    <div className="font-medium text-gray-900">
                        {row.stats?.coupons ?? 0} total · {row.stats?.activeCoupons ?? 0} usable
                    </div>
                    {row.coupons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {row.coupons.slice(0, 4).map((c) => (
                                <span key={c.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-mono text-xs">
                                    <Ticket className="w-3 h-3" />
                                    {c.code}
                                </span>
                            ))}
                            {row.coupons.length > 4 && <span className="text-xs text-gray-500">+{row.coupons.length - 4} more</span>}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: 'stats',
            label: 'Uses',
            render: (_value, row) => {
                const total = row.stats?.totalUses ?? 0;
                const used = row.stats?.usedUses ?? 0;
                const pct = total ? Math.round((used / total) * 100) : 0;
                return (
                    <div className="w-36">
                        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>
                                {used} / {total} used
                            </span>
                            <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{row.stats?.usesLeft ?? 0} left on usable coupons</div>
                    </div>
                );
            },
        },
        {
            key: 'isActive',
            label: 'Status',
            render: (value) => (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {value ? 'Active' : 'Inactive'}
                </span>
            ),
        },
    ];

    const formFields = useMemo<FormField[]>(
        () => [
            { name: 'name', label: 'Doctor Name', type: 'text', required: true, placeholder: 'e.g. Dr. Ahmed Khan' },
            { name: 'clinic', label: 'Clinic / Hospital', type: 'text', required: false, placeholder: 'Optional' },
            { name: 'phone', label: 'Phone', type: 'text', required: false, placeholder: 'Optional' },
            { name: 'email', label: 'Email', type: 'text', required: false, placeholder: 'Optional' },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false, rows: 3, placeholder: 'Optional' },
            {
                name: 'isActive',
                label: 'Status',
                type: 'select',
                required: false,
                options: [
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                ],
                hint: 'Inactive doctors are hidden when creating new coupons. Their coupons keep working.',
            },
        ],
        [],
    );

    // Memoized: the form resets whenever this changes.
    const initialData = useMemo(
        () =>
            editingDoctor
                ? {
                      name: editingDoctor.name,
                      clinic: editingDoctor.clinic || '',
                      phone: editingDoctor.phone || '',
                      email: editingDoctor.email || '',
                      notes: editingDoctor.notes || '',
                      isActive: String(editingDoctor.isActive),
                  }
                : { isActive: 'true' },
        [editingDoctor],
    );

    const sum = (pick: (s: DoctorStats) => number) => doctors.reduce((total, d) => total + (d.stats ? pick(d.stats) : 0), 0);
    const stats = [
        { label: 'Doctors', value: doctors.length, gradient: 'bg-gradient-to-br from-teal-100 to-cyan-100' },
        { label: 'Coupons Given', value: sum((s) => s.coupons), gradient: 'bg-gradient-to-br from-violet-100 to-purple-100' },
        { label: 'Coupon Uses', value: sum((s) => s.usedUses), gradient: 'bg-gradient-to-br from-blue-100 to-cyan-100' },
        { label: 'Uses Left', value: sum((s) => s.usesLeft), gradient: 'bg-gradient-to-br from-green-100 to-emerald-100' },
    ];

    return (
        <>
            <CrudTable
                data={doctors}
                columns={columns}
                loading={loading}
                error={error}
                onEdit={(doctor) => {
                    setEditingDoctor(doctor);
                    setIsModalOpen(true);
                }}
                onDelete={handleDelete}
                onAdd={() => {
                    setEditingDoctor(null);
                    setIsModalOpen(true);
                }}
                title="Doctors"
                description="Doctors who give coupon codes to their patients, and how many of their coupons were used"
                icon={Stethoscope}
                searchPlaceholder="Search doctors..."
                emptyMessage="No doctors yet. Add one, then give them coupons on the Coupon Codes page."
                stats={stats}
            />

            <FormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                title={editingDoctor ? `Edit Doctor: ${editingDoctor.name}` : 'Add Doctor'}
                fields={formFields}
                initialData={initialData}
                submitLabel={editingDoctor ? 'Save Changes' : 'Add Doctor'}
            />
        </>
    );
};

export default DoctorComponent;
