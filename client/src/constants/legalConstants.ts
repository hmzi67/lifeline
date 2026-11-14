import type { LegalContact, LegalPageData } from "@/types/legal";

export const LEGAL_LAST_UPDATED = "August 13, 2026";

export const LEGAL_CONTACT: LegalContact = {
  company: "Lifeline Dev Pvt Ltd",
  email: "info@makelifeline.com",
};

export const TERMS_CONDITIONS_DATA: LegalPageData = {
  title: "Terms and Conditions",
  lastUpdated: LEGAL_LAST_UPDATED,
  introduction: `Welcome to LifeLine! These Terms and Conditions ("Terms") govern your use of the LifeLine mobile application ("App"), developed, owned, and operated by Lifeline Dev Pvt Ltd ("Company", "we", "us", or "our"). By downloading, installing, or using the LifeLine App, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the App.`,
  sections: [
    {
      id: "medical-disclaimer",
      title: "1. Medical & Health Disclaimer (Crucial Notice)",
      note: `IMPORTANT DISCLAIMER: LifeLine is designed strictly for general health, fitness, and educational purposes. The App does not provide medical advice, diagnosis, or treatment.`,
      items: [
        {
          label: "Not a Medical Device",
          text: "The content, features, tracking tools, and data provided within LifeLine are not intended to replace professional medical advice, diagnosis, or treatment.",
        },
        {
          label: "Consult a Healthcare Professional",
          text: "Always seek the advice of your physician or other qualified healthcare provider with any questions you may have regarding a medical condition, diet, or exercise regimen.",
        },
        {
          label: "Emergency Situations",
          text: "Never disregard professional medical advice or delay seeking it because of something you read or tracked on LifeLine. If you think you may have a medical emergency, call your local emergency services immediately.",
        },
      ],
    },
    {
      id: "user-accounts",
      title: "2. User Accounts & Registration",
      items: [
        {
          label: "Account Creation",
          text: "To access certain features of the App, you may be required to register for an account. You agree to provide accurate, current, and complete information during registration.",
        },
        {
          label: "Account Security",
          text: "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.",
        },
        {
          label: "Age Requirement",
          text: "You must be at least 13 years of age (or the legal minimum age in your jurisdiction) to use LifeLine. If you are under 18, you must have parental or guardian consent.",
        },
      ],
    },
    {
      id: "privacy-data-collection",
      title: "3. Privacy & Data Collection",
      content: `Your privacy is paramount to us. Our collection, use, and sharing of your personal and fitness data are governed by our Privacy Policy. By using the App, you consent to our handling of your data in accordance with our Privacy Policy and Google Play's User Data Policies.`,
      link: { to: "/privacy", label: "Read our Privacy Policy" },
    },
    {
      id: "acceptable-use",
      title: "4. Acceptable Use & Prohibited Conduct",
      content: `You agree to use LifeLine only for lawful purposes. You agree not to:`,
      items: [
        {
          text: "Reverse engineer, decompile, or attempt to extract the source code of the App.",
        },
        { text: "Use the App to transmit spam, malware, or harmful content." },
        {
          text: "Interfere with or disrupt the integrity or performance of the App or its underlying servers.",
        },
        {
          text: "Attempt unauthorized access to other user accounts or system infrastructure.",
        },
      ],
    },
    {
      id: "intellectual-property",
      title: "5. Intellectual Property Rights",
      content: `All rights, title, and interest in and to the LifeLine App (including software, UI design, graphics, branding, logos, and content) are and will remain the exclusive property of Lifeline Dev Pvt Ltd.`,
      outro: `You are granted a limited, non-exclusive, non-transferable, revocable license to download and use the App for personal, non-commercial use on eligible mobile devices.`,
    },
    {
      id: "subscriptions-payments",
      title: "6. Subscriptions, Payments & In-App Purchases (If Applicable)",
      items: [
        {
          label: "Billing",
          text: "If LifeLine offers paid features, premium tiers, or in-app purchases, billing will be handled directly through your Google Play Store Account.",
        },
        {
          label: "Automatic Renewal",
          text: "Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current billing period in your Google Play settings.",
        },
        {
          label: "Cancellations & Refunds",
          text: "Managing and canceling subscriptions or requesting refunds must be done via your Google Play account settings in accordance with Google Play refund policies.",
        },
      ],
    },
    {
      id: "disclaimers-liability",
      title: "7. Disclaimers & Limitation of Liability",
      items: [
        {
          label: '"As-Is" Basis',
          text: 'LifeLine is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, express or implied.',
        },
        {
          label: "Limitation of Liability",
          text: "To the maximum extent permitted by applicable law, Lifeline Dev Pvt Ltd shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of health data, arising out of or related to your use of or inability to use the App.",
        },
      ],
    },
    {
      id: "updates-termination",
      title: "8. App Updates & Termination",
      items: [
        {
          label: "Updates",
          text: "We may update or upgrade the App periodically to improve performance, add features, or address security vulnerabilities.",
        },
        {
          label: "Termination",
          text: "We reserve the right to suspend or terminate your access to the App at our sole discretion, without notice, for conduct that violates these Terms or harms other users or our business interests.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "9. Governing Law",
      content: `These Terms shall be governed by and construed in accordance with the laws of Pakistan, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in Pakistan.`,
    },
    {
      id: "changes-to-terms",
      title: "10. Changes to These Terms",
      content: `We reserve the right to update or modify these Terms at any time. We will notify you of any material changes by updating the "Last Updated" date at the top of these Terms or via in-app notifications. Your continued use of LifeLine after changes are posted constitutes acceptance of the revised Terms.`,
    },
    {
      id: "contact-us",
      title: "11. Contact Us",
      content: `If you have any questions, feedback, or legal inquiries regarding these Terms and Conditions, please contact us at:`,
    },
  ],
  contact: LEGAL_CONTACT,
};

export const PRIVACY_POLICY_DATA: LegalPageData = {
  title: "Privacy Policy",
  lastUpdated: LEGAL_LAST_UPDATED,
  introduction: `Lifeline Dev Pvt Ltd ("Company", "we", "us", or "our") operates the LifeLine mobile application ("App"). This Privacy Policy informs you of our policies regarding the collection, use, disclosure, and protection of personal and health-related data when you use our App. By downloading, installing, or using LifeLine, you agree to the collection and use of information in accordance with this policy.`,
  sections: [
    {
      id: "information-we-collect",
      title: "1. Information We Collect",
      content: `To provide, improve, and personalize our health and fitness services, we collect several types of information:`,
      subsections: [
        {
          title: "A. Personal Data Provided by You",
          items: [
            {
              label: "Account Information",
              text: "Name, email address, password, age, gender, height, weight, and general fitness goals.",
            },
            {
              label: "Communication Data",
              text: "Information you provide when contacting us via customer support (info@makelifeline.com).",
            },
          ],
        },
        {
          title: "B. Health, Fitness & Sensor Data (With Your Explicit Permission)",
          items: [
            {
              label: "Activity & Fitness Metrics",
              text: "Step count, distance traveled, workout types, calories burned, active duration, and water intake.",
            },
            {
              label: "Biometric & Health Indicators",
              text: "Heart rate, sleep logs, body measurements, or other wellness data logged manually or synced via connected devices.",
            },
            {
              label: "Device Sensor Data",
              text: "Data from built-in device sensors (e.g., pedometer/accelerometer) to track movement and physical activity.",
            },
          ],
        },
        {
          title: "C. System Permissions & Device Information",
          items: [
            {
              label: "Device Identifiers",
              text: "Device model, operating system version, unique device identifiers, and network information.",
            },
            {
              label: "Optional Runtime Permissions",
              text: "Camera access (for profile photo uploads or QR scanning) or Storage access, requested only when needed for specific features.",
            },
          ],
        },
      ],
    },
    {
      id: "how-we-use-your-data",
      title: "2. How We Use Your Data",
      content: `We use the collected data solely to provide, support, and enhance your user experience:`,
      items: [
        { text: "To create and manage your user account." },
        {
          text: "To generate personalized fitness insights, track progress, and calculate daily health metrics.",
        },
        {
          text: "To ensure technical performance, fix bugs, and prevent fraudulent or unauthorized activity.",
        },
        {
          text: "To respond to customer service requests and communicate important app updates.",
        },
      ],
      note: `Zero Advertising/Profiling Guarantee: We do not sell, rent, or lease your health and fitness data to third parties, data brokers, or advertisers. Your health data is never used for commercial ad targeting, credit scoring, or user profiling.`,
    },
    {
      id: "health-frameworks",
      title: "3. Integration with Third-Party Health Frameworks (e.g., Google Health Connect)",
      content: `If you choose to connect LifeLine with third-party health platforms (such as Google Health Connect or Google Fit), our use of that data is subject to strict limitations:`,
      items: [
        {
          label: "Purpose Limitation",
          text: "We only request access to data types strictly necessary to power LifeLine's core user-facing features.",
        },
        {
          label: "No Prohibited Uses",
          text: "Data accessed via Health Connect APIs will never be transferred to third parties for advertising, retargeting, or market research.",
        },
        {
          label: "User Control",
          text: "You can grant, revoke, or manage permission settings at any time directly through your device's system settings or Health Connect app.",
        },
      ],
    },
    {
      id: "data-sharing",
      title: "4. Data Sharing & Disclosure",
      content: `We do not disclose your personal or health data except in the following limited circumstances:`,
      items: [
        {
          label: "Service Providers",
          text: "We may share non-health technical data with trusted cloud hosting and backend infrastructure providers who act strictly under our instructions and are bound by confidentiality obligations.",
        },
        {
          label: "Legal Requirements",
          text: "We may disclose your information if required to do so by law or in response to valid requests by public authorities (e.g., a court or government agency).",
        },
        {
          label: "Business Transfers",
          text: "If Lifeline Dev Pvt Ltd is involved in a merger, acquisition, or asset sale, your information will remain subject to the commitments made in this Privacy Policy.",
        },
      ],
    },
    {
      id: "data-retention-deletion",
      title: "5. Data Retention & Deletion Rights",
      items: [
        {
          label: "Data Retention",
          text: "We retain your personal data only for as long as your account remains active or as needed to provide you with App services.",
        },
        {
          label: "Account & Data Deletion",
          text: "You have the right to request the deletion of your account and all associated personal and health data. You can initiate data deletion directly within the App under Settings > Delete Account. Alternatively, you may submit a deletion request by emailing info@makelifeline.com. Upon request, all stored personal and health metrics will be permanently purged from our primary servers within 30 days.",
        },
      ],
    },
    {
      id: "data-security",
      title: "6. Data Security",
      content: `We implement industry-standard technical, organizational, and physical security measures—including end-to-end transport encryption (HTTPS/TLS) and secure database storage—to protect your sensitive health data from unauthorized access, alteration, or disclosure. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`,
    },
    {
      id: "childrens-privacy",
      title: "7. Children's Privacy",
      content: `LifeLine is not directed to children under the age of 13 (or the relevant age threshold in your jurisdiction). We do not knowingly collect personal data from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at info@makelifeline.com, and we will promptly delete such information.`,
    },
    {
      id: "changes-to-policy",
      title: "8. Changes to This Privacy Policy",
      content: `We may update our Privacy Policy from time to time to reflect changes in our practices or legal obligations. We will notify you of any material changes by updating the "Last Updated" date at the top of this document or via a prominent notification within the App.`,
    },
    {
      id: "contact-information",
      title: "9. Contact Information",
      content: `For any privacy-related questions, concerns, or data requests, please reach out to us:`,
    },
  ],
  contact: LEGAL_CONTACT,
};

export const COOKIE_POLICY_DATA: LegalPageData = {
  title: "Cookie & Tracking Policy",
  lastUpdated: LEGAL_LAST_UPDATED,
  introduction: `This Cookie & Tracking Policy explains how Lifeline Dev Pvt Ltd ("Company", "we", "us", or "our") uses cookies, local storage, mobile device identifiers, and similar tracking technologies within the LifeLine mobile application ("App") and associated web services (e.g., makelifeline.com).`,
  sections: [
    {
      id: "what-are-cookies",
      title: "1. What Are Cookies & Local Storage Technologies?",
      items: [
        {
          label: "Cookies",
          text: "Small text files stored on your browser or device when visiting a web page or web view.",
        },
        {
          label: "Local Storage & Mobile Tokens",
          text: "Mobile native applications (like Android apps) generally do not use browser cookies in the traditional sense. Instead, they use native device storage mechanisms (such as shared preferences, encrypted local databases, and session tokens) to perform equivalent functions, like keeping you logged in.",
        },
      ],
    },
    {
      id: "how-we-use-tracking",
      title: "2. How We Use Tracking Technologies",
      content: `We use these technologies for essential operations, performance monitoring, and service optimization:`,
      subsections: [
        {
          title: "A. Strictly Necessary / Essential Tokens",
          items: [
            {
              label: "Authentication",
              text: "Keeping you securely signed into your LifeLine account without requiring you to re-enter credentials on every screen.",
            },
            {
              label: "Session Management",
              text: "Maintaining active app sessions and caching temporary health preferences locally on your device for smooth navigation.",
            },
          ],
        },
        {
          title: "B. Functional & Performance Storage",
          items: [
            {
              label: "Preference Tracking",
              text: "Storing local settings such as app language, dark/light theme, measurement units (kg/lbs, km/miles), and notification preferences.",
            },
            {
              label: "Offline Caching",
              text: "Storing offline health/workout data temporarily until your device reconnects to our servers.",
            },
          ],
        },
        {
          title: "C. Analytics & Crash Reporting (Anonymized)",
          items: [
            {
              label: "Performance Metrics",
              text: "Understanding app speed, network latency, and resource consumption.",
            },
            {
              label: "Crash Logs",
              text: "Collecting diagnostic data (e.g., device model, Android version, and error stack traces) via tools like Google Firebase Crashlytics to fix bugs.",
            },
          ],
        },
      ],
      note: `Note on Health & Ad Data: We do not use cookies or trackers to collect sensitive health metrics for advertising or marketing profiling. We do not sell your tracking data to third-party data brokers.`,
    },
    {
      id: "third-party-sdks",
      title: "3. Third-Party Analytics & SDKs",
      content: `The LifeLine App may integrate limited third-party Software Development Kits (SDKs) to maintain app reliability and functionality. These SDKs may utilize device identifiers (such as Android Advertising ID or Instance IDs) solely for service optimization:`,
      items: [
        {
          label: "Google Firebase / Play Services",
          text: "Used for app infrastructure, crash reporting, performance monitoring, and sending push notifications.",
        },
        {
          label: "Third-Party Integrations",
          text: "If you choose to link Google Health Connect or other fitness platforms, device APIs facilitate data exchange strictly based on your permission.",
        },
      ],
    },
    {
      id: "your-choices",
      title: "4. Your Choices & How to Manage Trackers",
      content: `You have full control over local storage and device identifiers:`,
      items: [
        {
          label: "In-App Preferences",
          text: "You can manage notification settings and data synchronization preferences directly in the LifeLine App Settings.",
        },
        {
          label: "Android Device Settings",
          text: "You can clear local app data and cache at any time by navigating to: Settings > Apps > LifeLine > Storage & Cache > Clear Cache / Clear Data.",
        },
        {
          label: "Resetting Advertising ID",
          text: "You can reset or delete your device's Advertising ID via: Settings > Privacy > Ads > Delete Advertising ID.",
        },
      ],
    },
    {
      id: "changes-to-cookie-policy",
      title: "5. Changes to This Cookie Policy",
      content: `We may update this policy periodically to reflect operational, legal, or regulatory changes. Any modifications will be updated with a new "Last Updated" date at the top of this document.`,
    },
    {
      id: "cookie-contact",
      title: "6. Contact Us",
      content: `If you have questions about our use of cookies, local storage, or tracking technologies, please contact us:`,
    },
  ],
  contact: LEGAL_CONTACT,
};

export const COPYRIGHT_POLICY_DATA: LegalPageData = {
  title: "Copyright Policy",
  lastUpdated: LEGAL_LAST_UPDATED,
  introduction: `This Copyright Policy explains who owns the content in the LifeLine mobile application ("App") and associated web services (e.g., makelifeline.com), how you may use it, and how to report material you believe infringes your copyright. It is operated by Lifeline Dev Pvt Ltd ("Company", "we", "us", or "our").`,
  sections: [
    {
      id: "copyright-ownership",
      title: "1. Copyright Ownership",
      content: `Unless otherwise stated, all content in the App and on our websites, including software, text, workout and diet plans, meditation audio, videos, images, graphics, logos, and UI design, is owned by or licensed to Lifeline Dev Pvt Ltd and is protected by copyright and other intellectual property laws.`,
      outro: `© Lifeline Dev Pvt Ltd. All rights reserved.`,
    },
    {
      id: "permitted-use",
      title: "2. Permitted Use",
      content: `You may view and use our content for your own personal, non-commercial purposes through the App and website. Without our prior written permission, you may not:`,
      items: [
        { text: "Copy, reproduce, republish, or redistribute our content." },
        { text: "Sell, license, or otherwise commercially exploit our content." },
        { text: "Modify or create derivative works from our content." },
        { text: "Remove or alter any copyright, trademark, or other proprietary notices." },
      ],
      link: { to: "/terms", label: "See our Terms & Conditions" },
    },
    {
      id: "third-party-content",
      title: "3. Third-Party Content & Trademarks",
      content: `Some content, names, and logos belong to third parties (for example, Google, Google Play, and Health Connect) and are used under licence or for identification only. They remain the property of their respective owners.`,
    },
    {
      id: "reporting-infringement",
      title: "4. Reporting Copyright Infringement",
      content: `We respect the intellectual property of others. If you believe content available through LifeLine infringes your copyright, please send a written notice to the email address below that includes:`,
      items: [
        { text: "Your full name, address, phone number, and email address." },
        { text: "A description of the copyrighted work you claim has been infringed." },
        { text: "The location of the allegedly infringing material (for example, a URL or the screen in the App)." },
        { text: "A statement that you have a good-faith belief that the use is not authorised by the copyright owner, its agent, or the law." },
        { text: "A statement that the information in your notice is accurate and that you are the copyright owner or authorised to act on the owner's behalf." },
        { text: "Your physical or electronic signature." },
      ],
      note: `Submitting a knowingly false or misleading infringement notice may expose you to legal liability.`,
    },
    {
      id: "our-response",
      title: "5. How We Respond",
      content: `On receiving a complete notice, we will review it and may remove or disable access to the material, notify the person who provided it, and, where appropriate, suspend or terminate the accounts of repeat infringers.`,
    },
    {
      id: "changes-to-copyright-policy",
      title: "6. Changes to This Policy",
      content: `We may update this policy from time to time. Any changes will be reflected by a new "Last Updated" date at the top of this page.`,
    },
    {
      id: "copyright-contact",
      title: "7. Contact Us",
      content: `To send a copyright notice or ask about using our content, please contact us:`,
    },
  ],
  contact: LEGAL_CONTACT,
};
