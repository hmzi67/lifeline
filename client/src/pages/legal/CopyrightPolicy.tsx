import React from 'react';
import LegalPage from '@/components/legal/LegalPage';
import { COPYRIGHT_POLICY_DATA } from '@/constants/legalConstants';

const CopyrightPolicy: React.FC = () => {
    return <LegalPage data={COPYRIGHT_POLICY_DATA} />;
};

export default CopyrightPolicy;
