# Lifeline Frontend

A modern React application built with TypeScript, Vite, and TailwindCSS.

## Project Structure

```
src/
├── assets/         # Static assets (images, fonts, etc.)
├── components/     # Reusable components
│   ├── common/    # Site-wide shared components (Header, Footer, Layout)
│   └── ui/        # UI component library
├── config/        # App configuration and environment variables
├── constants/     # Application constants and enums
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and helper methods
├── pages/         # Route components organized by feature
│   ├── auth/      # Authentication pages
│   ├── content/   # Blog and content pages
│   ├── dashboard/ # Dashboard related pages
│   ├── fitness/   # Fitness tracking pages
│   ├── marketing/ # Marketing and landing pages
│   └── utility/   # Utility pages (Error, etc.)
├── services/      # API and external service integrations
├── store/         # State management
└── types/         # TypeScript types and interfaces
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone [repository-url]
cd lifeline-frontend
```

2. Install dependencies:

```bash
npm install
```

3. Create a .env file in the root directory:

```bash
cp .env.example .env
```

4. Update the environment variables in .env as needed.

### Development

To start the development server:

```bash
npm run dev
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests with Vitest

## Technology Stack

- **Framework:** React 19
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **UI Components:**
  - Radix UI
  - Custom UI components
- **State Management:** React Context/Local State
- **HTTP Client:** Axios
- **Routing:** React Router DOM
- **Form Validation:** Zod
- **Testing:** Vitest

## Environment Variables

| Variable     | Description     | Default               |
| ------------ | --------------- | --------------------- |
| VITE_API_URL | Backend API URL | http://localhost:3000 |

## Best Practices

- Component organization follows feature-first architecture
- Consistent file naming convention
- TypeScript for type safety
- Centralized API service configuration
- Environment-based configuration
- Proper error handling and loading states

## Contributing

1. Create a new branch
2. Make your changes
3. Submit a pull request




- LOGO COMPONENT IN AUTH (Delete In Future)
