# Connect Commons

Connect Commons is a comprehensive Learning Management System (LMS) platform designed to streamline educational workflows, assignment management, and student-teacher interactions. Built with a modern React frontend and a robust Supabase backend.

## Features

- **Authentication & Security:** Secure login and protected routes using Supabase Auth.
- **Role-Based Access Control:** Distinct workflows and dashboards for Admins (Teachers) and Users (Students).
- **Assignment Management:** Admins can create, manage, and attach reference files to assignments.
- **Submission Workflow:** Students can easily submit their assignments and track their status.
- **Review & Feedback:** Admins can review student submissions and provide direct feedback.
- **Notifications & Announcements:** Integrated notification system for real-time updates and class announcements.
- **Activity Tracking:** Comprehensive logging of system activity and submissions.

## Tech Stack

- **Frontend:** React, Vite
- **Styling:** Tailwind CSS, shadcn/ui
- **Backend & Database:** Supabase (PostgreSQL)
- **Storage:** Supabase Storage (for assignment reference files and student submissions)

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn
- A Supabase project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/abhishek-goswami1/Connect_Commons.git
   cd Connect_Commons
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials (refer to `.env.example` if available):
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Database Setup

The `supabase/migrations` folder contains all the necessary SQL scripts to set up the database schema, including tables for profiles, assignments, submissions, notifications, and storage policies. 

## License

This project is licensed under the MIT License.
