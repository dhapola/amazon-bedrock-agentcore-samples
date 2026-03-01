# Frontend - Travel with Agentic Commerce

React SPA with soft pastel design, Cognito authentication, and real-time metrics dashboard.

## Features

- **Beautiful Login Screen** - Animated floating shapes with soft pastel colors
- **Cognito Authentication** - OAuth 2.0 with hosted UI
- **Chat Interface** - Natural conversation with AI agent
- **Metrics Dashboard** - Real-time monitoring (tools, tokens, cost, latency)
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

- React 18.3.1
- Vite 5.1.0
- Framer Motion 11.0.0
- AWS Cognito (react-oidc-context)
- Custom CSS with CSS variables

## Development

### Dev Mode (No Authentication)
```bash
# Create .env file
echo "VITE_DEV_MODE=true" > .env

# Install and run
npm install
npm run dev

# Visit http://localhost:8080
```

### Production Mode (With Authentication)
```bash
# .env is auto-updated by deployment script
npm install
npm run dev

# Visit http://localhost:8080
```

## Environment Variables

```env
# Dev mode (skips authentication)
VITE_DEV_MODE=true

# Production (auto-configured by deployment)
VITE_DEV_MODE=false
VITE_COGNITO_DOMAIN=https://your-domain.auth.region.amazoncognito.com
VITE_COGNITO_USER_POOL_ID=region_PoolId
VITE_COGNITO_CLIENT_ID=ClientId
VITE_COGNITO_REDIRECT_URI=https://your-cloudfront.cloudfront.net
VITE_COGNITO_LOGOUT_URI=https://your-cloudfront.cloudfront.net
```

## Project Structure

```
src/
├── components/
│   ├── ChatInterface.jsx     # Chat UI with message thread
│   ├── Sidebar.jsx           # Metrics dashboard
│   ├── auth/
│   │   ├── AuthProvider.tsx  # Cognito authentication wrapper
│   │   └── AutoSignin.tsx    # Auto-signin component
│   └── ui/
│       └── button.jsx        # Reusable button component
├── hooks/
│   ├── useAuth.ts            # Authentication hook
│   ├── UseMobile.ts          # Mobile detection hook
│   └── useToolRenderer.ts    # Tool rendering hook
├── lib/
│   └── auth.ts               # Auth utilities
├── App.jsx                   # Main app component
├── main.jsx                  # React entry point
├── App.css                   # App styles
└── index.css                 # Global styles & theme
```

## Design System

### Color Palette (CSS Variables)
```css
--primary-purple: #9b87f5
--primary-pink: #f5a3c7
--primary-blue: #7dd3fc
--primary-peach: #fbbf77
--primary-mint: #a7f3d0
--bg-cream: #fef9f3
--bg-white: #ffffff
```

### Typography
- Headings: Quicksand (700)
- Body: Nunito (400, 600, 700, 800)

### Component Patterns
- Rounded corners (16-24px)
- Soft shadows with purple tints
- Gradient backgrounds
- Emoji icons
- Bouncy animations (spring easing)

## Build

```bash
# Development build
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Deployment

The frontend is deployed automatically by `infrastructure/deploy-frontend.sh`:

1. Updates `.env` with Cognito configuration
2. Builds the app with `npm run build`
3. Uploads to S3
4. Invalidates CloudFront cache

See [../infrastructure/README.md](../infrastructure/README.md) for deployment instructions.

## Authentication Flow

1. User clicks "Sign In"
2. Redirects to Cognito Hosted UI
3. User enters credentials
4. Cognito redirects back with authorization code
5. Frontend exchanges code for tokens
6. Tokens stored in localStorage
7. Authenticated requests use tokens

## Troubleshooting

### "Authentication not configured"
Check that `.env` has all required Cognito variables. Run `../infrastructure/update-env.sh` to refresh.

### "Redirect URI mismatch"
Ensure `.env` has correct CloudFront domain. Get from CloudFormation outputs.

### Build has wrong configuration
If you manually updated `.env`, rebuild: `npm run build`

## License

MIT
