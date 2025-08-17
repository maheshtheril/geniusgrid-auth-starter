set -e
shopt -s nullglob

fix_layout_file() {
  f="$1"
  # A) Make the grid mobile-first and shrinkable
  sed -i -E 's|min-h-\[calc\(100vh-48px\)\] grid md:grid-cols-\[260px_1fr\] gap-4 p-4 md:p-6|min-h-[calc(100vh-48px)] grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-4 p-4 sm:p-5 md:p-6|g' "$f"

  # B) Let the main pane shrink & scroll (first .space-y-4 in Admin layout)
  sed -i -E '0,/"space-y-4"/s/className="space-y-4"/className="space-y-4 min-w-0 overflow-x-auto"/' "$f"

  # (Optional) Sidebar min width at md+
  sed -i -E 's/className="h-full sticky top-4 hidden md:block"/className="h-full sticky top-4 hidden md:block md:min-w-\[260px]/' "$f"
}

# Try split layout first, else monolith file
[ -f src/modules/admin/layout/AdminLayout.jsx ] && fix_layout_file src/modules/admin/layout/AdminLayout.jsx
[ -f src/modules/admin/AdminModule.jsx ] && fix_layout_file src/modules/admin/AdminModule.jsx

# C) Make search inputs responsive (layout + page toolbars)
#   w-64 -> w-full md:w-64,  w-60 -> w-full md:w-60
for f in $(grep -RIl --exclude-dir=node_modules 'className="pl-8 w-6' src/modules/admin 2>/dev/null || true); do
  sed -i -E 's/className="pl-8 w-64"/className="pl-8 w-full md:w-64"/g' "$f"
  sed -i -E 's/className="pl-8 w-60"/className="pl-8 w-full md:w-60"/g' "$f"
done

# D) (Optional but helpful) allow tables to scroll horizontally
# If you have a DataTable component, add overflow to CardContent in that file only.
for f in src/modules/admin/components/DataTable.jsx src/modules/admin/AdminModule.jsx; do
  [ -f "$f" ] || continue
  # only change the first CardContent (the table one); safe enough for scaffold
  sed -i -E '0,/<CardContent>/s/<CardContent>/<CardContent className="overflow-x-auto">/' "$f"
  # add a sensible min width for table wrapper if present
  sed -i -E '0,/<div className="rounded-md border">/s/<div className="rounded-md border">/<div className="rounded-md border min-w-\[640px]">/' "$f"
done

echo "✅ Responsive patch applied."
