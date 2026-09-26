import { buildRoadmapReadme } from './src/readmeExport.js';

// Real roadmap data matching IdeaForge backend output
const sampleRoadmap = {
  original_idea: "A subscription and recurring expense management platform where users sign up, track monthly subscriptions, organize by category, and get renewal alerts.",
  feasibility: "intermediate",
  difficulty_breakdown: {
    frontend_complexity: "intermediate",
    backend_complexity: "intermediate",
    database_complexity: "intermediate",
    ai_complexity: "not_applicable",
    deployment_complexity: "beginner"
  },
  estimated_weeks: 6,
  recommended_stack: [
    "React (Frontend UI)",
    "Node.js / Express (REST API)",
    "PostgreSQL (Relational Database)",
    "Prisma (ORM)",
    "Nodemailer (Email Alerts)"
  ],
  setup_guide: {
    primary_language: "TypeScript / JavaScript (full-stack cohesion across client and server)",
    editor_recommendation: "VS Code with ESLint and Prettier extensions for formatting and linting.",
    key_tools: [
      { name: "Vite", purpose: "Fast frontend build tooling and HMR" },
      { name: "Prisma Studio", purpose: "Visual GUI to inspect and manipulate PostgreSQL tables" },
      { name: "Docker", purpose: "Containerized local PostgreSQL database instance" }
    ],
    getting_started_command: "git clone https://github.com/example/subtracker.git && npm install && npx prisma migrate dev"
  },
  suggested_schema: [
    {
      table_name: "users",
      fields: [
        { name: "id", type: "serial", notes: "primary key" },
        { name: "email", type: "string", notes: "unique" },
        { name: "password_hash", type: "string", notes: "" },
        { name: "created_at", type: "timestamp", notes: "" },
        { name: "updated_at", type: "timestamp", notes: "" }
      ]
    },
    {
      table_name: "categories",
      fields: [
        { name: "id", type: "serial", notes: "primary key" },
        { name: "name", type: "string", notes: "unique" },
        { name: "description", type: "text", notes: "optional" }
      ]
    },
    {
      table_name: "subscriptions",
      fields: [
        { name: "id", type: "serial", notes: "primary key" },
        { name: "user_id", type: "integer", notes: "foreign key to users" },
        { name: "name", type: "string", notes: "" },
        { name: "amount", type: "numeric", notes: "" },
        { name: "cycle", type: "string", notes: "e.g., monthly, yearly" },
        { name: "next_renewal", type: "timestamp", notes: "date of next renewal" },
        { name: "category_id", type: "integer", notes: "foreign key to categories" },
        { name: "created_at", type: "timestamp", notes: "" },
        { name: "updated_at", type: "timestamp", notes: "" },
        { name: "alert_sent", type: "boolean", notes: "whether renewal alert has been sent" }
      ]
    }
  ],
  mvp_features: [
    "User authentication via JWT (signup, login, session persistence)",
    "CRUD subscriptions (name, amount, frequency, renewal date, category)",
    "Dashboard summary card displaying monthly recurring total",
    "Categorization system (Work, Entertainment, Utilities)",
    "Email alerts sent 3 days before renewal date"
  ],
  stretch_features: [
    "Bank sync integration via Plaid for automated transaction matching",
    "Multi-currency conversion with live exchange rates",
    "Export subscription expense reports as CSV / PDF"
  ],
  milestones: [
    {
      week: 1,
      goal: "Project scaffolding, database schema setup, and user authentication",
      tasks: [
        "Initialize Vite React frontend and Node/Express backend",
        "Set up PostgreSQL with Prisma ORM and create schema migrations",
        "Implement JWT signup and login endpoints"
      ]
    },
    {
      week: 2,
      goal: "Subscription management CRUD and category organization",
      tasks: [
        "Build REST API endpoints for subscriptions and categories",
        "Develop subscription creation modal with category selector",
        "Create responsive list view of active subscriptions"
      ]
    },
    {
      week: 3,
      goal: "Dashboard analytics, renewal calculation, and automated alerts",
      tasks: [
        "Implement monthly expense total and breakdown calculation",
        "Build background cron job to check upcoming renewals",
        "Configure Nodemailer to send email reminders 3 days in advance"
      ]
    },
    {
      week: 4,
      goal: "Testing, polish, and cloud deployment",
      tasks: [
        "Write integration tests for subscription API endpoints",
        "Implement responsive mobile styling and dark mode",
        "Deploy backend to Render and frontend to Vercel"
      ]
    }
  ],
  potential_pitfalls: [
    "Timezone handling differences between client browser and server cron job for renewal dates",
    "Email delivery reliability without dedicated SPF/DKIM configured SMTP provider"
  ]
};

const readme = buildRoadmapReadme(sampleRoadmap);
console.log("=== GENERATED README.md OUTPUT ===");
console.log(readme);
console.log("=== END OF README.md ===");
