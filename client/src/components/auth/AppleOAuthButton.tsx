import React from 'react';
import { Button } from '@/components/ui/button';
import { config } from '@/config';

interface AppleOAuthButtonProps {
    text?: string;
    disabled?: boolean;
    className?: string;
}

const AppleOAuthButton: React.FC<AppleOAuthButtonProps> = ({
    text = "Continue with Apple",
    disabled = false,
    className = "",
}) => {
    const handleAppleLogin = () => {
        // Redirect to backend Sign in with Apple endpoint; it returns to /auth/callback
        window.location.href = `${config.apiUrl}/auth/apple`;
    };

    return (
        <Button
            type="button"
            onClick={handleAppleLogin}
            disabled={disabled}
            className={`w-full  flex items-center justify-center gap-3 bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 py-6 rounded-lg transition-colors ${className}`}
        >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.47 2.26-1.21 3.07-.8.87-2.1 1.54-3.16 1.46-.13-1.1.42-2.27 1.16-3.04.82-.87 2.21-1.51 3.21-1.49zM20.5 17.37c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.39 3.5-4.12 3.51-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.02-3.05-1.77-4.04-3.33C-.07 16.13-.36 11.03 1.4 8.35c1.25-1.9 3.22-3.01 5.07-3.01 1.89 0 3.08 1.04 4.64 1.04 1.52 0 2.44-1.04 4.62-1.04 1.65 0 3.39.9 4.63 2.45-4.07 2.23-3.41 8.04.14 9.58z" />
            </svg>
            {text}
        </Button>
    );
};

export default AppleOAuthButton;
