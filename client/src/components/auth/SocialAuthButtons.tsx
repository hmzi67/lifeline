import React from 'react';
import AppleOAuthButton from './AppleOAuthButton';
import GoogleOAuthButton from './GoogleOAuthButton';

const SocialAuthButtons: React.FC = () => {
    return (
        <div className="grid grid-cols-2 gap-4">
            <GoogleOAuthButton text="Google" />
            <AppleOAuthButton text="Apple" />
        </div>
    );
};

export default SocialAuthButtons;
