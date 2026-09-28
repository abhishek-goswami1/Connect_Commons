$ErrorActionPreference = "Stop"

# Navigate to LMS
cd "C:\Users\ASUS\OneDrive\Desktop\LMS\LMS"

# Ensure we are on main
git checkout main
git pull origin main

function DoFeature {
    param(
        [string]$Branch,
        [string]$Message,
        [string[]]$Files
    )
    Write-Host "Processing $Branch..."
    
    # Check if branch exists locally, if so, delete it or just use it.
    # We will create it.
    git checkout -b $Branch
    
    foreach ($f in $Files) {
        if (Test-Path $f) {
            git add $f
        } elseif ($f -eq ".") {
            git add .
        }
    }
    
    # Commit
    $status = git status --porcelain
    if ($status) {
        git commit -m $Message
        git push -u origin $Branch
        
        # Merge to main locally
        git checkout main
        git merge $Branch
        git push origin main
    } else {
        # If no changes, go back to main
        git checkout main
    }
}

# 1. Authentication / project setup
DoFeature -Branch "feature/authentication" -Message "feat: implement authentication and protected routes" -Files @(
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "tailwind.config.js",
    "postcss.config.js",
    "jsconfig.json",
    "index.html",
    ".eslintrc.cjs",
    ".env.example",
    ".gitignore",
    "src/index.css",
    "src/App.css",
    "src/App.jsx",
    "src/main.jsx",
    "src/lib/supabase.js",
    "src/utils/supabase.js",
    "src/utils/supabase.ts",
    "src/context/AuthContext.jsx",
    "src/routes/ProtectedRoute.jsx",
    "src/routes/AdminRoute.jsx",
    "src/routes/UserRoute.jsx",
    "src/pages/auth/LoginPage.jsx",
    "src/pages/auth/InactiveAccountPage.jsx",
    "src/components/ui/alert-dialog.jsx",
    "src/components/ui/badge.jsx",
    "src/components/ui/button.jsx",
    "src/components/ui/card.jsx",
    "src/components/ui/checkbox.jsx",
    "src/components/ui/dialog.jsx",
    "src/components/ui/input.jsx",
    "src/components/ui/label.jsx",
    "src/components/ui/select.jsx",
    "src/components/ui/textarea.jsx",
    "src/lib/utils.js",
    "supabase/migrations/20240001_create_profiles.sql",
    "supabase/functions/create-user/index.ts"
)

# 2. User management / roles
DoFeature -Branch "feature/user-management" -Message "feat: add role based user management" -Files @(
    "src/pages/admin/UsersPage.jsx",
    "src/hooks/useUsers.js",
    "src/hooks/useProfile.js"
)

# 3. Assignment management
DoFeature -Branch "feature/assignment-management" -Message "feat: implement assignment management" -Files @(
    "supabase/migrations/20240002_create_assignments.sql",
    "src/pages/admin/AssignmentsPage.jsx",
    "src/pages/admin/CreateAssignmentPage.jsx",
    "src/pages/admin/EditAssignmentPage.jsx",
    "src/hooks/useAssignments.js",
    "src/lib/assignmentHelpers.js",
    "supabase/migrations/20240007_core_workflow_fixes.sql"
)

# 4. Assignment reference/source files
DoFeature -Branch "feature/reference-files" -Message "feat: add assignment reference file uploads" -Files @(
    "supabase/migrations/20240004_create_storage_buckets.sql",
    "supabase/migrations/20240005_fix_storage_policies.sql",
    "supabase/migrations/20240009_robust_storage_policies.sql"
)

# 5. Submission workflow
DoFeature -Branch "feature/submission-workflow" -Message "feat: implement user submission workflow" -Files @(
    "supabase/migrations/20240003_create_submissions.sql",
    "src/pages/user/UserDashboard.jsx",
    "src/pages/user/UserAssignmentDetailPage.jsx"
)

# 6. Review / feedback / approval
DoFeature -Branch "feature/review-feedback" -Message "feat: implement admin review and feedback" -Files @(
    "src/pages/admin/AdminAssignmentDetailPage.jsx"
)

# 7. Notifications / announcements
DoFeature -Branch "feature/notifications" -Message "feat: add notifications and announcements" -Files @(
    "supabase/migrations/20240006_notifications_announcements_activity.sql",
    "src/pages/admin/AnnouncementsPage.jsx",
    "src/pages/admin/ActivityLogPage.jsx",
    "src/pages/user/UserAnnouncementsPage.jsx",
    "src/components/NotificationBell.jsx",
    "src/hooks/useNotifications.js",
    "supabase/functions/send-email-notification/index.ts",
    "supabase/functions/send-email-notification/README.md"
)

# 8. Admin dashboard
DoFeature -Branch "feature/admin-dashboard" -Message "feat: complete admin dashboard submission tracking" -Files @(
    "src/pages/admin/AdminDashboard.jsx",
    "src/layouts/AdminLayout.jsx"
)

# 9. Final workflow fixes (Add all remaining files)
DoFeature -Branch "feature/final-workflow-fixes" -Message "fix: resolve submitted files not appearing in admin dashboard" -Files @(
    "."
)

Write-Host "Migration completed successfully!"
