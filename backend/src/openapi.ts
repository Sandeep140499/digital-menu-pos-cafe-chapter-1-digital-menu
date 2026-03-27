// Build servers list dynamically so we can include Railway / other deployments
// without hardcoding a single URL.
const servers = [
  {
    url: '/api',
    description: 'Same host (default: current backend URL)',
  },
  {
    url: 'http://localhost:4000/api',
    description: 'Local development (Node backend on :4000)',
  },
  {
    url: 'https://digital-menu-pos-cafe-chapter-1-digital.onrender.com/api',
    description: 'Deployed Render backend',
  },
  {
    url: 'https://digital-menu-pos-cafe-chapter-1-digital-menu-production.up.railway.app/api',
    description: 'Deployed Railway backend (production)',
  },
] as { url: string; description: string }[];

// Railway exposes the public domain via RAILWAY_PUBLIC_DOMAIN by default, e.g.
// RAILWAY_PUBLIC_DOMAIN=your-app.up.railway.app
// If present, add it as a Swagger server entry.
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  servers.push({
    url: `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`,
    description: 'Deployed Railway backend',
  });
}

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Gautam Nagar Digital Menu POS API',
    version: '1.0.0',
    description:
      'REST API for the Gautam Nagar Digital Menu POS system (auth, employees, shifts, orders, reports, menu, config, notifications, etc.).',
  },
  // Multiple servers so Swagger UI lets the user choose
  // between local dev and the deployed backends.
  servers,
  tags: [
    { name: 'Health', description: 'Health checks' },
    { name: 'Auth', description: 'Authentication and passwords' },
    { name: 'Employees', description: 'Employees, invites, shifts, salary' },
    { name: 'Shifts', description: 'Employee shifts and auto close' },
    { name: 'Orders', description: 'Orders and live dashboard' },
    { name: 'Payments', description: 'Payments and settlements' },
    { name: 'Reports', description: 'Reports and exports' },
    { name: 'Menu', description: 'Menu categories and items' },
    { name: 'Config', description: 'Branch configuration & public config' },
    { name: 'Branches', description: 'Branches and directors' },
    { name: 'Notifications', description: 'Admin notifications' },
    { name: 'CustomerQueries', description: 'Customer queries / feedback' },
    { name: 'Overtime', description: 'Employee overtime tracking' },
    { name: 'Late', description: 'Late arrivals tracking' },
    { name: 'ErrorLogs', description: 'Error log inspection' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns ok: true when the API is healthy.',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { ok: { type: 'boolean' } },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Admin/Employee login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  loginAs: {
                    type: 'string',
                    enum: ['admin', 'employee'],
                  },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful; returns token and role.' },
          '401': { description: 'Invalid credentials.' },
        },
      },
    },
    '/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Send forgot-password email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { email: { type: 'string', format: 'email' } },
                required: ['email'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Email sent (if account exists).' },
        },
      },
    },
    '/employees': {
      get: {
        tags: ['Employees'],
        summary: 'List employees',
        description: 'Admin: list all employees.',
        responses: {
          '200': { description: 'Array of employees.' },
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'Create employee',
        description: 'Admin: create a new employee.',
        responses: {
          '201': { description: 'Employee created.' },
        },
      },
    },
    '/employees/active': {
      get: {
        tags: ['Employees'],
        summary: 'List active employees',
        responses: {
          '200': { description: 'Array of active employees.' },
        },
      },
    },
    '/employees/me': {
      get: {
        tags: ['Employees'],
        summary: 'Get current employee profile',
        responses: {
          '200': { description: 'Employee profile for the current token.' },
          '401': { description: 'Not authenticated / invalid token.' },
        },
      },
    },
    '/employees/{id}/verify-and-send-invite': {
      post: {
        tags: ['Employees'],
        summary: 'Send verification + invite email to employee',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
          },
        ],
        responses: {
          '200': { description: 'Verification email sent.' },
          '404': { description: 'Employee not found.' },
        },
      },
    },
    '/employees/verify-email-link': {
      get: {
        tags: ['Employees'],
        summary: 'Verify employee email via magic link',
        parameters: [
          {
            name: 'token',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'HTML page confirming verification and providing login details.',
            content: { 'text/html': {} },
          },
          '400': { description: 'Invalid or expired token.' },
        },
      },
    },
    '/shift/active': {
      get: {
        tags: ['Shifts'],
        summary: 'List active shifts',
        responses: {
          '200': { description: 'Current active shifts.' },
        },
      },
    },
    '/shift/current': {
      get: {
        tags: ['Shifts'],
        summary: 'Get current employee shift',
        responses: {
          '200': { description: 'Current shift info for the employee.' },
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Create customer order',
        responses: {
          '201': { description: 'Order created.' },
        },
      },
    },
    '/orders/live': {
      get: {
        tags: ['Orders'],
        summary: 'List live orders for dashboard',
        parameters: [
          {
            name: 'date',
            in: 'query',
            schema: { type: 'string', format: 'date' },
          },
        ],
        responses: {
          '200': { description: 'Live orders for admin dashboard.' },
        },
      },
    },
    '/menu': {
      get: {
        tags: ['Menu'],
        summary: 'List menu for customers',
        responses: {
          '200': { description: 'Public menu categories and items.' },
        },
      },
    },
    '/menu/admin': {
      get: {
        tags: ['Menu'],
        summary: 'Admin menu view',
        responses: {
          '200': { description: 'Menu with admin/editing fields.' },
        },
      },
    },
    '/config/branch-contact': {
      get: {
        tags: ['Config'],
        summary: 'Public branch contact info',
        responses: {
          '200': {
            description: 'Contact info used on the customer menu page.',
          },
        },
      },
    },
    '/reports/dashboard-summary': {
      get: {
        tags: ['Reports'],
        summary: 'Dashboard summary',
        description: 'Admin dashboard KPIs and summary metrics.',
        responses: {
          '200': { description: 'Summary metrics.' },
        },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        parameters: [
          {
            name: 'unreadOnly',
            in: 'query',
            schema: { type: 'integer', enum: [0, 1] },
          },
        ],
        responses: {
          '200': { description: 'Notifications list.' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste your JWT as: **Bearer &lt;token&gt;**. Obtain it from the `/auth/login` endpoint.',
      },
    },
  },
  // Global auth: by default, all endpoints require bearerAuth unless they
  // explicitly override `security: []` at the operation level.
  security: [
    {
      bearerAuth: [],
    },
  ],
};
