import assert from 'assert'
import { buildRoadmapReadme } from './src/readmeExport.js'
import {
  buildSrsDocument,
  buildSynopsisDocument,
  buildVivaQuestionsDocument
} from './src/docsExport.js'
import { buildRoadmapPdf } from './src/pdfExport.js'

console.log('=== STARTING V2 & BACKWARD COMPATIBILITY TEST SUITE ===')

// Sample V2 Blueprint data
const sampleV2Blueprint = {
  schema_version: 2,
  original_idea: 'I want to build a dairy management system',
  project_summary: {
    title: 'DairyFlow - Modern Dairy Management System',
    one_line_description: 'An end-to-end operational software for dairy farms tracking milk yields, cattle health, inventory, and automated billing.',
    problem_statement: 'Small and medium dairy farms suffer from manual paper-based milk recording, untracked veterinary schedules, and delayed invoicing.',
    target_users: ['Farm Owners', 'Field Workers', 'Veterinarians', 'Milk Distributors'],
    project_type: 'Full-Stack Web Application',
    difficulty: 'Intermediate',
    estimated_duration: '6 Weeks'
  },
  assumptions: [
    { assumption: 'Relational database selected', reason: 'Relational integrity is necessary for daily milk yields linked to cattle and billing records.' },
    { assumption: 'Role-based access control', reason: 'Workers should only record yields, while farm owners manage financials.' }
  ],
  requirements: {
    functional: ['Record daily milk collection per cattle', 'Automate monthly customer billing statements', 'Track vaccination dates'],
    non_functional: ['Page loads under 1 second', 'Encrypted database credentials', 'Works offline on mobile for 30 minutes']
  },
  user_roles: [
    { role: 'Farm Admin', description: 'Full access to financial analytics and cattle inventory', permissions: ['manage_users', 'view_revenue', 'export_reports'] },
    { role: 'Field Worker', description: 'Records milk yields and feed intake', permissions: ['record_milk', 'log_feed'] }
  ],
  features: {
    mvp: [
      { name: 'Milk Collection Logging', description: 'Log liters per cattle ID with fat content and timestamp', priority: 'High', why_needed: 'Core farm revenue tracking' },
      { name: 'Cattle Health Records', description: 'Maintain medical histories and breeding dates', priority: 'High', why_needed: 'Prevents disease outbreaks and loss' }
    ],
    future: [
      { name: 'IoT Milk Tank Sensors', description: 'Automatic milk volume measurement' }
    ]
  },
  user_flows: [
    { name: 'Morning Milk Recording', steps: ['Worker selects Cattle ID', 'Worker enters liters and fat %', 'System saves and updates daily yield total'] }
  ],
  screens: [
    { name: 'Dashboard', purpose: 'Overview of daily liters and cattle health alerts', elements: ['Yield Chart', 'Recent Logs', 'Alerts Box'], actions: ['Filter by date', 'Export CSV'] },
    { name: 'Milk Entry Form', purpose: 'Fast mobile-friendly data entry', elements: ['Cattle Selector', 'Liters Input', 'Save Button'], actions: ['Submit entry'] }
  ],
  recommended_stack: [
    { technology: 'React + Vite', purpose: 'Frontend SPA', why_recommended: 'Fast reactive user interface with offline cache support', alternatives: ['Vue.js', 'Next.js'] },
    { technology: 'FastAPI (Python)', purpose: 'Backend REST API', why_recommended: 'High performance async API with automatic OpenAPI documentation', alternatives: ['Express.js', 'Django'] },
    { technology: 'PostgreSQL', purpose: 'Relational Database', why_recommended: 'ACID transactional integrity for financial and inventory ledgers', alternatives: ['MySQL', 'SQLite'] }
  ],
  architecture: {
    overview: 'Three-tier architecture with React frontend communicating via REST API to FastAPI and PostgreSQL.',
    components: ['React SPA', 'FastAPI Server', 'PostgreSQL DB'],
    data_flow: [
      'Worker fills form in React UI',
      'POST /api/v1/milk-logs sent with JWT auth header',
      'FastAPI validates payload using Pydantic',
      'Record inserted into PostgreSQL milk_logs table',
      'Real-time total recalculated and returned'
    ]
  },
  database: {
    needed: true,
    tables: [
      {
        name: 'cattle',
        purpose: 'Stores registered cows and buffaloes on the farm',
        fields: [
          { name: 'id', type: 'UUID', constraints: 'PK', description: 'Unique animal identifier' },
          { name: 'tag_number', type: 'VARCHAR(50)', constraints: 'UNIQUE', description: 'Ear tag number' },
          { name: 'breed', type: 'VARCHAR(100)', constraints: 'NOT NULL', description: 'Animal breed' }
        ],
        relationships: ['has many milk_logs']
      },
      {
        name: 'milk_logs',
        purpose: 'Daily records of collected milk',
        fields: [
          { name: 'id', type: 'BIGSERIAL', constraints: 'PK', description: 'Record ID' },
          { name: 'cattle_id', type: 'UUID', constraints: 'FK -> cattle.id', description: 'Reference to cattle' },
          { name: 'liters', type: 'NUMERIC(5,2)', constraints: 'NOT NULL', description: 'Liters collected' },
          { name: 'logged_at', type: 'TIMESTAMP WITH TIME ZONE', constraints: 'DEFAULT NOW()', description: 'Collection time' }
        ],
        relationships: ['belongs to cattle']
      }
    ]
  },
  api_design: [
    { method: 'POST', endpoint: '/api/v1/milk-logs', purpose: 'Create new collection log', auth_required: true, request_summary: '{ cattle_id, liters, fat_percentage }', response_summary: '{ id, recorded_at }' },
    { method: 'GET', endpoint: '/api/v1/analytics/daily-yield', purpose: 'Retrieve aggregated daily yield', auth_required: true, request_summary: 'None', response_summary: '{ date, total_liters, avg_fat }' }
  ],
  folder_structure: {
    description: 'Clean modular monorepo separating frontend and backend',
    tree: `dairyflow/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── api/
│   └── package.json
└── backend/
    ├── app/
    │   ├── routers/
    │   ├── models/
    │   └── database.py
    └── requirements.txt`
  },
  setup_guide: {
    prerequisites: ['Node.js 18+', 'Python 3.11+', 'PostgreSQL 15+'],
    software_to_install: ['Git', 'VS Code', 'Docker Desktop (optional)'],
    commands: [
      { step: 1, command: 'git clone https://github.com/dairyflow/dairyflow.git', purpose: 'Clone repository' },
      { step: 2, command: 'cd backend && pip install -r requirements.txt', purpose: 'Install Python dependencies' },
      { step: 3, command: 'uvicorn app.main:app --reload', purpose: 'Start backend development server' }
    ]
  },
  implementation_plan: [
    {
      phase: 1,
      name: 'Foundation & Database Modeling',
      goal: 'Set up development environment and initialize database tables',
      tasks: [
        {
          task: 'Initialize Database and Alembic Migrations',
          description: 'Create PostgreSQL connection pool and establish cattle and milk_logs migrations.',
          files_or_modules: ['backend/database.py', 'backend/alembic/env.py'],
          how_to_test: 'Run alembic upgrade head and confirm tables created in psql.',
          definition_of_done: 'Tables cattle and milk_logs exist with correct constraints and indexes.'
        },
        {
          task: 'Build Authentication & JWT Flow',
          description: 'Implement user signup, login, and token generation.',
          files_or_modules: ['backend/app/auth.py', 'backend/app/routers/auth.py'],
          how_to_test: 'POST /auth/login returns valid access_token.',
          definition_of_done: 'Protected endpoints reject unauthenticated requests with HTTP 401.'
        }
      ]
    },
    {
      phase: 2,
      name: 'Milk Logging Core Operations',
      goal: 'Build logging endpoints and mobile data entry UI',
      tasks: [
        {
          task: 'Create Milk Logging REST Endpoints',
          description: 'CRUD endpoints for recording milk collections.',
          files_or_modules: ['backend/app/routers/milk.py'],
          how_to_test: 'Send POST /api/v1/milk-logs with mock payload and verify DB record.',
          definition_of_done: 'API validates positive volume and stores timestamp accurately.'
        }
      ]
    }
  ],
  testing_plan: {
    manual: ['Test milk entry on simulated 3G mobile connection', 'Verify CSV export matches entered totals'],
    unit: ['Test yield sum calculation function', 'Test token validation middleware'],
    integration: ['End-to-end test of POST /milk-logs updating daily analytics'],
    security: ['Verify worker token cannot access farm owner financial analytics']
  },
  security_plan: [
    'Store bcrypt password hashes with work factor 12',
    'Enforce HTTPS and Strict-Transport-Security headers',
    'Rate-limit API endpoints to 60 requests/minute per IP'
  ],
  deployment_plan: {
    frontend: 'Vercel (Automatic GitHub deployment)',
    backend: 'Render (Dockerized FastAPI web service)',
    database: 'Neon Serverless PostgreSQL with daily automated backups',
    environment_variables: ['DATABASE_URL', 'SECRET_KEY', 'CORS_ORIGINS'],
    steps: [
      'Create Neon PostgreSQL instance and copy connection string',
      'Configure environment variables on Render backend',
      'Deploy frontend to Vercel and point VITE_API_URL to Render backend'
    ]
  },
  common_mistakes: [
    { problem: 'Storing milk yield timestamps in local timezone instead of UTC', solution: 'Always use TIMESTAMP WITH TIME ZONE and convert to farm local timezone in frontend.' }
  ],
  learning_path: [
    { topic: 'FastAPI & Pydantic Validation', why_needed: 'Ensures invalid milk volumes or dates never corrupt database', when_to_learn: 'Phase 1' }
  ],
  launch_checklist: [
    'Run full database migration on staging database',
    'Verify CORS headers allow production frontend domain only',
    'Test backup restoration script'
  ]
}

// 1. Test V2 README generation
console.log('\n--- 1. Testing V2 Blueprint README Generation ---')
const v2Readme = buildRoadmapReadme(sampleV2Blueprint)
assert(v2Readme.includes('DairyFlow - Modern Dairy Management System'), 'Missing title')
assert(v2Readme.includes('Architectural Assumptions'), 'Missing assumptions')
assert(v2Readme.includes('FastAPI (Python)'), 'Missing tech stack')
assert(v2Readme.includes('Actionable Implementation Plan'), 'Missing build plan')
assert(v2Readme.includes('Entity Table: `cattle`'), 'Missing database tables')
assert(v2Readme.includes('POST') && v2Readme.includes('/api/v1/milk-logs'), 'Missing api endpoints')
console.log('✓ V2 README generation passed! Length:', v2Readme.length)

// 2. Test V2 SRS Document generation
console.log('\n--- 2. Testing V2 Blueprint SRS Document Generation ---')
const v2Srs = buildSrsDocument(sampleV2Blueprint)
assert(v2Srs.includes('Software Requirements Specification (SRS)'), 'Missing SRS title')
assert(v2Srs.includes('DairyFlow - Modern Dairy Management System'), 'Missing project title')
assert(v2Srs.includes('User Classes & Authorization Roles'), 'Missing roles')
assert(v2Srs.includes('Functional Requirements'), 'Missing functional requirements')
assert(v2Srs.includes('Non-Functional Requirements'), 'Missing non-functional requirements')
assert(v2Srs.includes('Database Design & Data Dictionary'), 'Missing DB schema')
console.log('✓ V2 SRS Document generation passed! Length:', v2Srs.length)

// 3. Test V2 Synopsis Document generation
console.log('\n--- 3. Testing V2 Blueprint Synopsis Generation ---')
const v2Synopsis = buildSynopsisDocument(sampleV2Blueprint)
assert(v2Synopsis.includes('Project Synopsis: DairyFlow - Modern Dairy Management System'), 'Missing synopsis title')
assert(v2Synopsis.includes('Problem Statement'), 'Missing problem statement')
assert(v2Synopsis.includes('Technology Stack'), 'Missing tech stack')
assert(v2Synopsis.includes('Database Entities'), 'Missing database entities')
console.log('✓ V2 Synopsis Document generation passed! Length:', v2Synopsis.length)

// 4. Test Viva Questions formatting with V2 stack
console.log('\n--- 4. Testing Viva Questions Document Generation with V2 Stack ---')
const vivaData = {
  questions: [
    {
      category: 'Architecture',
      question: 'Why did you choose FastAPI over Flask for this dairy system?',
      model_answer: 'FastAPI provides native asynchronous endpoints, automatic Pydantic validation, and high throughput.',
      viva_tip: 'Highlight async execution and built-in OpenAPI schema generation.'
    }
  ]
}
const v2Viva = buildVivaQuestionsDocument(sampleV2Blueprint, vivaData)
assert(!v2Viva.includes('[object Object]'), 'Viva questions contains [object Object]')
assert(v2Viva.includes('FastAPI'), 'Viva questions should include tech name')
console.log('✓ Viva Questions with V2 stack passed! Length:', v2Viva.length)

// 5. Test V2 PDF generation
console.log('\n--- 5. Testing V2 PDF Generation ---')
const v2Pdf = buildRoadmapPdf(sampleV2Blueprint)
assert(v2Pdf !== null && typeof v2Pdf.getNumberOfPages === 'function', 'Invalid PDF instance')
assert(v2Pdf.getNumberOfPages() >= 1, 'Expected at least 1 page')
console.log('✓ V2 PDF generation passed! Total pages:', v2Pdf.getNumberOfPages())

// 6. Test Backward Compatibility: Legacy V1 Roadmap
console.log('\n--- 6. Testing Legacy V1 Roadmap Backward Compatibility ---')
const legacyV1Roadmap = {
  original_idea: 'Simple Pomodoro timer in Python',
  feasibility: 'Beginner',
  estimated_weeks: 2,
  recommended_stack: ['Python', 'Tkinter', 'playsound'],
  mvp_features: ['Start and pause 25-minute timer', 'Play bell sound on completion', 'Task counter'],
  stretch_features: ['Custom break intervals', 'Historical statistics log'],
  milestones: [
    {
      week: 1,
      goal: 'Basic UI and Countdown Timer',
      tasks: ['Set up Python project and Tkinter window', 'Implement countdown tick handler', 'Add Start/Stop button']
    },
    {
      week: 2,
      goal: 'Audio Notifications and Settings',
      tasks: ['Integrate audio sound on completion', 'Package as standalone executable']
    }
  ],
  setup_guide: {
    primary_language: 'Python 3.10+',
    editor_recommendation: 'VS Code with Python extension',
    getting_started_command: 'python -m venv venv && pip install playsound',
    key_tools: [{ name: 'Tkinter', purpose: 'Desktop GUI toolkit' }]
  }
}

const legacyReadme = buildRoadmapReadme(legacyV1Roadmap)
assert(legacyReadme.includes('Simple Pomodoro timer in Python'), 'Legacy README title missing')
assert(legacyReadme.includes('Tkinter'), 'Legacy README stack missing')
assert(legacyReadme.includes('Week 1'), 'Legacy README milestones missing')

const legacySrs = buildSrsDocument(legacyV1Roadmap)
assert(legacySrs.includes('Software Requirements Specification (SRS)'), 'Legacy SRS missing')
assert(legacySrs.includes('Tkinter'), 'Legacy SRS stack missing')

const legacySynopsis = buildSynopsisDocument(legacyV1Roadmap)
assert(legacySynopsis.includes('Project Synopsis'), 'Legacy Synopsis missing')

const legacyPdf = buildRoadmapPdf(legacyV1Roadmap)
assert(legacyPdf.getNumberOfPages() >= 1, 'Legacy PDF page count invalid')
console.log('✓ Legacy V1 Roadmap backward compatibility passed 100% across README, SRS, Synopsis, and PDF!')

console.log('\n==================================================')
console.log('ALL V2 EXPORTS & BACKWARD COMPATIBILITY TESTS PASSED!')
console.log('==================================================')
