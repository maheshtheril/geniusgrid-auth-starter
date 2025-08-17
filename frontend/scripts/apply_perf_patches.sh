set -euo pipefail

# 1) Make CompaniesPage lazy in routes.companies.jsx and wrap with Suspense
f="src/pages/crm/companies/routes.companies.jsx"
if [ -f "$f" ]; then
  # Replace static import with lazy() const
  if grep -qE '^import\s+CompaniesPage\s+from\s+["'\'']@/pages/CompaniesPage(\.jsx)?["'\'']' "$f"; then
    sed -i -E 's|^import\s+CompaniesPage\s+from\s+["'\'']@/pages/CompaniesPage(\.jsx)?["'\''];?|const CompaniesPage = lazy(() => import("@/pages/CompaniesPage.jsx"));|' "$f"
  fi
  # Ensure we import { lazy, Suspense } from "react"
  if grep -qE 'import\s+\{\s*lazy[^}]*\}\s+from\s+["'\'']react["'\'']' "$f"; then
    :
  elif grep -qE 'import\s+\{\s*[^}]*\}\s+from\s+["'\'']react["'\'']' "$f"; then
    sed -i -E 's|import\s+\{\s*([^}]*)\}\s+from\s+["'\'']react["'\''];|import { \1, lazy, Suspense } from "react";|' "$f"
  else
    sed -i '1i import { lazy, Suspense } from "react";' "$f"
  fi
  # Wrap the element with Suspense (idempotent)
  sed -i -E 's|element=\{<CompaniesPage\s*/>\}|element={<Suspense fallback={<div className="p-4 text-sm">Loading Companies…</div>}><CompaniesPage /></Suspense>}|g' "$f"
fi

# 2) Trim flag-icons: include only a small subset via Sass
mkdir -p src/styles
cat > src/styles/flags.scss <<'EOF'
$fi-include: ("in", "us", "gb"); // add more ISO codes as needed
@import "flag-icons/sass/flag-icons";
EOF

# Replace heavy CSS import with our scoped SCSS in known files
for ff in src/components/leads/AddLeadDrawer.jsx src/pages/LeadCreate.jsx; do
  if [ -f "$ff" ]; then
    sed -i -E 's|import\s+["'\'']flag-icons/css/flag-icons\.min\.css["'\''];|import "@/styles/flags.scss";|' "$ff"
  fi
done

# 3) Ensure Icon.jsx has a default export (so both import styles work)
if [ -f src/components/ui/Icon.jsx ]; then
  if ! grep -q 'export default Icon' src/components/ui/Icon.jsx; then
    printf '\nexport default Icon;\n' >> src/components/ui/Icon.jsx
  fi
fi

echo "✅ Patches applied."
