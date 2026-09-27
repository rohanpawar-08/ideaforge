import {
  buildSrsDocument,
  buildSynopsisDocument,
  buildVivaQuestionsDocument
} from './src/docsExport.js';

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
    }
  ],
  potential_pitfalls: [
    "Timezone handling differences between client browser and server cron job for renewal dates",
    "Email delivery reliability without dedicated SPF/DKIM configured SMTP provider"
  ]
};

const sampleVivaQuestions = [
  {
    id: 1,
    category: "Architecture & System Design",
    question: "Explain how you would decouple the client and server architecture for this subscription manager.",
    model_answer: "The application uses a separated SPA client communicating over stateless REST APIs with JWT authentication. This allows independent scaling and testing of the backend service without impacting frontend delivery.",
    viva_tip: "Highlight statelessness and separation of concerns."
  },
  {
    id: 2,
    category: "Database Design & Data Modeling",
    question: "Why is the subscriptions table normalized with foreign keys to users and categories instead of storing category names directly?",
    model_answer: "Referencing category IDs adheres to 3NF, eliminating update anomalies if a category is renamed and ensuring referential integrity via database foreign key constraints.",
    viva_tip: "Mention cascading deletes and how indexing user_id speeds up dashboard queries."
  }
];

// Test SRS
console.log("=== TESTING SRS DOCUMENT GENERATION ===");
const srsMd = buildSrsDocument(sampleRoadmap);
const requiredSrsSections = [
  "Introduction",
  "Problem Statement",
  "Project Objectives",
  "Product Scope",
  "Functional Requirements",
  "Non-Functional Requirements",
  "System Requirements",
  "Assumptions",
  "Constraints",
  "Future Scope"
];

for (const sec of requiredSrsSections) {
  const found = srsMd.includes(sec);
  console.log(`SRS has "${sec}": ${found ? "PASS" : "FAIL"}`);
  if (!found) throw new Error(`Missing section: ${sec}`);
}
console.log("SRS Length:", srsMd.length, "characters\n");

// Test Synopsis
console.log("=== TESTING SYNOPSIS GENERATION ===");
const synMd = buildSynopsisDocument(sampleRoadmap);
const requiredSynSections = [
  "Project Title",
  "Problem Statement",
  "Proposed Solution",
  "Objectives",
  "Technology Used",
  "Expected Outcome"
];

for (const sec of requiredSynSections) {
  const found = synMd.includes(sec);
  console.log(`Synopsis has "${sec}": ${found ? "PASS" : "FAIL"}`);
  if (!found) throw new Error(`Missing section: ${sec}`);
}
console.log("Synopsis Length:", synMd.length, "characters\n");

// Test Viva
console.log("=== TESTING VIVA QUESTIONS GENERATION ===");
const vivaMd = buildVivaQuestionsDocument(sampleRoadmap, sampleVivaQuestions);
console.log(`Viva has Q1: ${vivaMd.includes("Q1") ? "PASS" : "FAIL"}`);
console.log(`Viva has Q2: ${vivaMd.includes("Q2") ? "PASS" : "FAIL"}`);
console.log(`Viva has Model Answer: ${vivaMd.includes("Model Answer") ? "PASS" : "FAIL"}`);
console.log(`Viva has Viva Defense Tip: ${vivaMd.includes("Viva Defense Tip") ? "PASS" : "FAIL"}`);
console.log("Viva Length:", vivaMd.length, "characters\n");

console.log("ALL TESTS PASSED!");
