Please perform a full Kalour Beauty Empire code cleanup and production-readiness pass.

Work carefully and continue task by task without waiting for my confirmation unless there is a serious blocker.

Goals:
1. Clean up code redundancy, unused files, unused imports, duplicated logic, and dead code.
2. Improve separation of concerns: keep UI, API calls, services, validation, permissions, and business logic properly separated.
3. Ensure all modules use real API/database data only. Remove all dummy/static/mock data, including profile, dashboard, products, orders, notifications, and settings.
4. Ensure all modules consistently use the backend API with proper loading, error, empty-state, and success handling.
5. Enforce permissions everywhere: frontend visibility plus backend/server/API protection. No restricted data or action should be accessible without permission.
6. Improve UI/UX consistency across dashboard and website: tables, forms, modals, dropdowns, buttons, notifications, loading states, spacing, fonts, colors, and responsiveness.
7. Improve loading states globally: skeletons/spinners/disabled states where needed, no layout jumping, no broken states.
8. Review forms and validation to ensure clean user feedback and no silent failures.
9. Check security basics: no secrets in code, proper env usage, safe API handling, protected routes, and no risky debug output.
10. Test the main flows after cleanup: login, dashboard, products, product creation/edit/view/delete, stock, notifications, profile, permissions, website products, filters, and order-related flows if available.

Rules:
- Do not rewrite the whole system unnecessarily.
- Make minimal, safe, professional changes.
- Keep the existing Kalour brand identity.
- Commit only working code.
- Before pushing, run tests/build/lint if available.
- Review `git diff` before commit.
- Use clear commit messages.

After finishing:
1. Push all completed source code to the project Git repository.
2. Create clear deployment documentation for our Hetzner server.
3. The deployment guide must be simple, step-by-step, and secure.
4. Include commands for pulling code, installing dependencies, building frontend/backend, running migrations, restarting services, configuring `.env`, Nginx, SSL, firewall, backups, and rollback.
5. Do not include real secrets/passwords/tokens in documentation. Use placeholders and `.env.example`.

Final report:
- Summary of cleanup completed
- Changed files
- What was improved
- Tests/build commands run and results
- Git commit hash
- Confirmation that code was pushed
- Location/name of the deployment documentation
- Any remaining risks or recommendations